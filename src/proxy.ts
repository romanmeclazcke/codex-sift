import http from "node:http";
import { Transform } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { URL } from "node:url";
import { injectIntoUnknown } from "./catalog.js";
import { assessEffectiveness, assessEffectivenessTokens, estimateInputTokens } from "./effectiveness.js";
import { decideTurn, estimateContextGrowth } from "./jev.js";
import { writeDecision } from "./log.js";
import type { Decision, Policy, SessionPin } from "./types.js";
import {
  conversationKey,
  hasImage,
  isNewUserTurn,
  lastUserText,
  requestModel,
  rewriteModel,
} from "./turns.js";
import {
  classifyPath,
  detectAuthMode,
  forwardHeaders,
  pipeUpstream,
  readIncoming,
  requestUpstream,
  upstreamFor,
} from "./upstream.js";

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": body.length,
  });
  res.end(body);
}

function responseFooter(decision: Decision, policy: Policy, outputText: string): string {
  const before = decision.effectiveness;
  const effectiveness = before && assessEffectivenessTokens(
    before.estimatedInputTokens + Math.ceil(Buffer.byteLength(outputText, "utf8") / 4),
    policy,
    before.jevAvailable ? before.needsMoreContext : null,
    before.contextWindowTokens,
  );
  const scores = effectiveness
    ? `\n_Estimated context after response: ${Math.round(effectiveness.occupancy * 100)}% used_\n_Token headroom: ${effectiveness.tokenScore}% · Task-adjusted headroom (Jev): ${effectiveness.jevAvailable ? `${effectiveness.score}%` : "unavailable"}_`
    : "\n_Token headroom: unavailable · Task-adjusted headroom (Jev): unavailable_";
  return `\n\n---\n_Model used: ${decision.model} · ${decision.lane}_${scores}`;
}

export class SseFooterTransform extends Transform {
  private buffer = "";
  private readonly decoder = new StringDecoder("utf8");
  private injected = false;
  private injectedFooter = "";
  private outputText = "";
  private lastTextEvent: Record<string, unknown> | null = null;

  constructor(private readonly footer: (outputText: string) => string) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.buffer += this.decoder.write(chunk);
    const parts = this.buffer.split(/(\r?\n\r?\n)/);
    this.buffer = parts.pop() || "";
    for (let i = 0; i < parts.length; i += 2) this.push(this.rewrite(parts[i]) + parts[i + 1]);
    callback();
  }

  override _flush(callback: (error?: Error | null) => void): void {
    this.buffer += this.decoder.end();
    if (this.buffer) this.push(this.rewrite(this.buffer));
    callback();
  }

  private rewrite(block: string): string {
    const lines = block.split(/\r?\n/);
    const dataIndex = lines.findIndex((line) => line.startsWith("data: "));
    if (dataIndex < 0) return block;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(lines[dataIndex].slice("data: ".length)) as Record<string, unknown>;
    } catch {
      return block;
    }
    if (payload.type === "response.output_text.delta" && !this.injected) {
      this.lastTextEvent = payload;
      if (typeof payload.delta === "string") this.outputText += payload.delta;
      return block;
    }
    if (payload.type === "response.output_text.done" && typeof payload.text === "string" && !this.injected) {
      this.outputText = payload.text;
      this.injectedFooter = this.footer(this.outputText);
      return this.injectBefore(block, lines, dataIndex, payload, true);
    }
    const prefix = payload.type === "response.completed" && this.lastTextEvent && !this.injected
      ? this.injectFromLast("")
      : "";
    if (this.injected && appendFooterToFinalEvent(payload, this.injectedFooter)) {
      lines[dataIndex] = `data: ${JSON.stringify(payload)}`;
      return prefix + lines.join(block.includes("\r\n") ? "\r\n" : "\n");
    }
    return prefix + block;
  }

  private injectFromLast(block: string): string {
    this.injectedFooter = this.footer(this.outputText);
    const delta: Record<string, unknown> = {
      ...this.lastTextEvent,
      type: "response.output_text.delta",
      delta: this.injectedFooter,
    };
    delete delta.text;
    this.injected = true;
    const newline = block.includes("\r\n") ? "\r\n" : "\n";
    return [`event: response.output_text.delta`, `data: ${JSON.stringify(delta)}`].join(newline) + newline + newline + block;
  }

  private injectBefore(
    block: string,
    lines: string[],
    dataIndex: number,
    payload: Record<string, unknown>,
    updateDoneText: boolean,
  ): string {

    const delta: Record<string, unknown> = { ...payload, type: "response.output_text.delta", delta: this.injectedFooter };
    delete delta.text;
    if (updateDoneText) {
      payload.text = `${payload.text}${this.injectedFooter}`;
      lines[dataIndex] = `data: ${JSON.stringify(payload)}`;
    }
    this.injected = true;
    const newline = block.includes("\r\n") ? "\r\n" : "\n";
    return [`event: response.output_text.delta`, `data: ${JSON.stringify(delta)}`].join(newline) + newline + newline + lines.join(newline);
  }
}

function appendFooterToFinalEvent(payload: Record<string, unknown>, footer: string): boolean {
  const type = payload.type;
  if (type === "response.content_part.done") {
    const part = payload.part;
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string" && !part.text.endsWith(footer)) {
      part.text += footer;
      return true;
    }
  }
  if (type === "response.output_item.done") return appendFooterToMessage(payload.item, footer);
  if (type === "response.completed") {
    const response = payload.response;
    if (response && typeof response === "object" && "output" in response && Array.isArray(response.output)) {
      for (let i = response.output.length - 1; i >= 0; i--) {
        if (appendFooterToMessage(response.output[i], footer)) return true;
      }
    }
  }
  return false;
}

function appendFooterToMessage(item: unknown, footer: string): boolean {
  if (!item || typeof item !== "object" || !("type" in item) || item.type !== "message" || !("content" in item) || !Array.isArray(item.content)) return false;
  for (let i = item.content.length - 1; i >= 0; i--) {
    const part = item.content[i];
    if (part && typeof part === "object" && part.type === "output_text" && typeof part.text === "string") {
      if (!part.text.endsWith(footer)) part.text += footer;
      return true;
    }
  }
  return false;
}

export function startProxy(policy: Policy, modelWindows: Record<string, number> = {}): Promise<{ server: http.Server; port: number; url: string }> {
  const sessions = new Map<string, SessionPin>();

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res, policy, sessions, modelWindows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end(`sift proxy error: ${message}`);
      } else {
        res.end();
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind loopback proxy"));
        return;
      }
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.on("error", reject);
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  policy: Policy,
  sessions: Map<string, SessionPin>,
  modelWindows: Record<string, number>,
): Promise<void> {
  const incoming = new URL(req.url || "/", "http://127.0.0.1");
  const kind = classifyPath(incoming.pathname);
  const mode = detectAuthMode(req.headers);
  const target = upstreamFor(mode, incoming.pathname, incoming.search);
  const targetUrl = new URL(target.path, target.origin);
  const method = req.method || "GET";

  if (kind !== "responses") {
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
    if (kind === "models" && method === "GET") {
      await proxyModels(req, res, targetUrl, policy);
      return;
    }
    pipeUpstream(targetUrl, method, forwardHeaders(req.headers, targetUrl.host), body, req, res);
    return;
  }

  const raw = await readBody(req);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw.toString("utf8") || "{}") as Record<string, unknown>;
  } catch {
    pipeUpstream(targetUrl, method, forwardHeaders(req.headers, targetUrl.host), raw, req, res);
    return;
  }

  const virtual = policy.virtual_model.slug;
  const model = requestModel(parsed);
  const key = conversationKey(parsed);
  const pin = sessions.get(key);
  const newTurn = isNewUserTurn(parsed);
  const prompt = lastUserText(parsed);
  let outbound = parsed;
  let decision: Decision | null = null;

  if (model && model !== virtual) {
    // User pinned a real model in /model. Do not route.
  } else if (!newTurn) {
    const lane = pin?.decision || policy.lanes[policy.on_jev_down];
    outbound = rewriteModel(parsed, lane.model, lane.effort);
    if (pin) {
      decision = { ...pin.decision };
      const window = policy.effectiveness.context_window_tokens || modelWindows[decision.model] || 272000;
      const prior = decision.effectiveness;
      decision.effectiveness = assessEffectiveness(parsed, policy, prior?.jevAvailable ? prior.needsMoreContext : null, window);
    }
  } else if (model === virtual || !model) {
    const retry = Boolean(pin && pin.decision.lane === "flash");
    decision = await decideTurn(policy, prompt, {
      hasImage: hasImage(parsed),
      retry,
      previousLane: pin?.decision.lane,
    });
    const estimatedTokens = estimateInputTokens(parsed);
    const contextWindow = policy.effectiveness.context_window_tokens || modelWindows[decision.model] || 272000;
    const growth = decision.degraded ? null : await estimateContextGrowth(policy, prompt, decision.model, estimatedTokens, contextWindow);
    decision.effectiveness = assessEffectiveness(parsed, policy, growth, contextWindow);
    outbound = rewriteModel(parsed, decision.model, decision.effort);
    sessions.set(key, { conversationKey: key, lastUserText: prompt, decision });
    writeDecision(decision, prompt);
  }

  const payload = Buffer.from(JSON.stringify(outbound));
  const headers = forwardHeaders(req.headers, targetUrl.host);
  headers["content-length"] = payload.length;
  headers["content-type"] = "application/json";
  const appendFooter = Boolean(decision && parsed.stream === true && process.env.SIFT_RESPONSE_FOOTER !== "0");
  if (appendFooter) headers["accept-encoding"] = "identity";
  pipeUpstream(
    targetUrl,
    method,
    headers,
    payload,
    req,
    res,
    appendFooter && decision
      ? (upstreamHeaders) => {
          const contentType = upstreamHeaders["content-type"];
          const encoding = upstreamHeaders["content-encoding"];
          if (typeof contentType !== "string" || !/^text\/event-stream(?:\s*;|\s*$)/i.test(contentType)) return undefined;
          if (encoding && String(encoding).toLowerCase() !== "identity") return undefined;
          return new SseFooterTransform((outputText) => responseFooter(decision, policy, outputText));
        }
      : undefined,
  );
}

async function proxyModels(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetUrl: URL,
  policy: Policy,
): Promise<void> {
  try {
    const up = await requestUpstream(targetUrl, "GET", forwardHeaders(req.headers, targetUrl.host));
    const raw = await readIncoming(up);
    try {
      const parsed = JSON.parse(raw.toString("utf8") || "{}");
      json(res, up.statusCode || 200, injectIntoUnknown(parsed, policy));
    } catch {
      res.writeHead(up.statusCode || 200, up.headers);
      res.end(raw);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`sift models error: ${message}`);
  }
}
