import http from "node:http";
import { URL } from "node:url";
import { injectIntoUnknown } from "./catalog.js";
import { decideTurn } from "./jev.js";
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

export function startProxy(policy: Policy): Promise<{ server: http.Server; port: number; url: string }> {
  const sessions = new Map<string, SessionPin>();

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res, policy, sessions);
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
  let outbound = parsed;
  let decision: Decision | null = null;

  if (model && model !== virtual) {
    // User pinned a real model in /model. Do not route.
  } else if (!isNewUserTurn(parsed) && pin) {
    outbound = rewriteModel(parsed, pin.decision.model, pin.decision.effort);
    decision = pin.decision;
  } else if (model === virtual || !model) {
    const prompt = lastUserText(parsed);
    const retry = Boolean(pin && pin.decision.lane === "flash");
    decision = await decideTurn(policy, prompt, {
      hasImage: hasImage(parsed),
      retry,
      previousLane: pin?.decision.lane,
    });
    outbound = rewriteModel(parsed, decision.model, decision.effort);
    sessions.set(key, { conversationKey: key, lastUserText: prompt, decision });
    writeDecision(decision, prompt);
  }

  const payload = Buffer.from(JSON.stringify(outbound));
  const headers = forwardHeaders(req.headers, targetUrl.host);
  headers["content-length"] = payload.length;
  headers["content-type"] = "application/json";
  pipeUpstream(targetUrl, method, headers, payload, req, res);
  void decision;
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
