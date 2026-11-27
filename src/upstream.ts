import http from "node:http";
import https from "node:https";
import type { IncomingMessage, RequestOptions } from "node:http";
import { StringDecoder } from "node:string_decoder";
import { URL } from "node:url";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export type AuthMode = "chatgpt" | "api";

export const CHATGPT_ORIGIN = "https://chatgpt.com";
export const OPENAI_ORIGIN = "https://api.openai.com";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);

export function detectAuthMode(headers: http.IncomingHttpHeaders): AuthMode {
  const account = headers["chatgpt-account-id"] || headers["ChatGPT-Account-Id"];
  if (account) return "chatgpt";
  return "api";
}

export function classifyPath(pathname: string): "responses" | "models" | "other" {
  if (/\/responses\/?$/.test(pathname) || pathname.endsWith("/codex/responses")) return "responses";
  if (/\/models\/?$/.test(pathname) || pathname.includes("/models?")) return "models";
  return "other";
}

export function upstreamFor(mode: AuthMode, pathname: string, search: string): { origin: string; path: string } {
  const kind = classifyPath(pathname);
  if (mode === "chatgpt") {
    const origin = process.env.SIFT_CHATGPT_ORIGIN || CHATGPT_ORIGIN;
    if (kind === "responses") return { origin, path: "/backend-api/codex/responses" };
    if (kind === "models") return { origin, path: `/backend-api/codex/models${search}` };
    const path = pathname.startsWith("/backend-api") ? `${pathname}${search}` : `/backend-api/codex${pathname}${search}`;
    return { origin, path };
  }
  const origin = process.env.SIFT_OPENAI_ORIGIN || OPENAI_ORIGIN;
  if (kind === "responses") return { origin, path: "/v1/responses" };
  if (kind === "models") return { origin, path: `/v1/models${search}` };
  const path = pathname.startsWith("/v1") ? `${pathname}${search}` : `/v1${pathname}${search}`;
  return { origin, path };
}

export function forwardHeaders(src: http.IncomingHttpHeaders, host: string): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(src)) {
    if (!value) continue;
    if (HOP.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  out.host = host;
  return out;
}

export function requestUpstream(
  url: URL,
  method: string,
  headers: http.OutgoingHttpHeaders,
  body?: Buffer,
): Promise<IncomingMessage> {
  const opts: RequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method,
    headers,
  };
  const transport = url.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = transport.request(opts, resolve);
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function readIncoming(up: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of up) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export type ResponseUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  reasoning_tokens?: number;
};

export type RequestOutcome = {
  outcome: "completed" | "failed" | "incomplete" | "canceled";
  status?: number;
  latency_ms: number;
  usage?: ResponseUsage;
};

export type ResponseObserver = {
  onResponseId?: (id: string) => void;
  onComplete?: (result: RequestOutcome) => void;
};

const OBSERVATION_LIMIT = 1024 * 1024;

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function responseOutcome(status: unknown): RequestOutcome["outcome"] | undefined {
  switch (status) {
    case "completed": return "completed";
    case "failed":
    case "error": return "failed";
    case "incomplete":
    case "queued":
    case "in_progress": return "incomplete";
    case "cancelled":
    case "canceled": return "canceled";
  }
}

function responseDecoder(encoding: string | undefined) {
  switch (encoding) {
    case "gzip": return createGunzip();
    case "deflate": return createInflate();
    case "br": return createBrotliDecompress();
  }
}

class ResponseMetadata {
  private decoder = new StringDecoder("utf8");
  private buffer = "";
  private event = "";
  private data: string[] = [];
  private eventLength = 0;
  private overflow = false;
  private discardLine = false;
  private responseId?: string;
  usage?: ResponseUsage;
  outcome?: RequestOutcome["outcome"];

  constructor(private stream: boolean, private onResponseId?: (id: string) => void) {}

  private payload(text: string, eventName: string): void {
    try {
      const payload = JSON.parse(text);
      if (!payload || typeof payload !== "object") return;
      const response = this.stream ? payload.response : payload;
      const event = typeof payload.type === "string" ? payload.type : eventName;
      if (typeof response?.id === "string" && response.id && response.id !== this.responseId) {
        this.responseId = response.id;
        this.onResponseId?.(response.id);
      }
      if (!this.stream || event === "error" || /^response\.(completed|failed|incomplete|cancelled|canceled)$/.test(event)) {
        const implicitOutcome = !this.stream && response?.status === undefined && typeof response?.id === "string"
          ? "completed"
          : undefined;
        this.outcome = responseOutcome(response?.status) ?? responseOutcome(event.split(".").at(-1)) ?? implicitOutcome ?? this.outcome;
        const raw = response?.usage;
        const usage: ResponseUsage = {
          input_tokens: tokenCount(raw?.input_tokens),
          output_tokens: tokenCount(raw?.output_tokens),
          total_tokens: tokenCount(raw?.total_tokens),
          cached_input_tokens: tokenCount(raw?.input_tokens_details?.cached_tokens),
          reasoning_tokens: tokenCount(raw?.output_tokens_details?.reasoning_tokens),
        };
        if (Object.values(usage).some((value) => value !== undefined)) this.usage = usage;
      }
    } catch {
      // Malformed or unsupported metadata never interrupts the forwarded response.
    }
  }

  private line(line: string): void {
    if (!line) {
      if (!this.overflow && this.data.length) this.payload(this.data.join("\n"), this.event);
      this.event = "";
      this.data = [];
      this.eventLength = 0;
      this.overflow = false;
      return;
    }
    this.eventLength += line.length + 1;
    if (this.eventLength > OBSERVATION_LIMIT) this.overflow = true;
    if (this.overflow) return;
    if (line.startsWith("event:")) this.event = line.slice(6).trim();
    if (line.startsWith("data:")) this.data.push(line.slice(5).replace(/^ /, ""));
  }

  private consume(text: string): void {
    if (!this.stream) {
      if (this.overflow || this.buffer.length + text.length > OBSERVATION_LIMIT) {
        this.overflow = true;
        this.buffer = "";
        return;
      }
      this.buffer += text;
      return;
    }
    const lines = text.split("\n");
    const tail = lines.pop() ?? "";
    for (const part of lines) {
      if (!this.discardLine) this.line((this.buffer + part).replace(/\r$/, ""));
      this.buffer = "";
      this.discardLine = false;
    }
    if (!this.discardLine) {
      this.buffer += tail;
      if (this.buffer.length > OBSERVATION_LIMIT) {
        this.overflow = true;
        this.discardLine = true;
        this.buffer = "";
      }
    }
  }

  add(chunk: Buffer): void {
    this.consume(this.decoder.write(chunk));
  }

  finish(): void {
    this.consume(this.decoder.end());
    if (this.stream) {
      if (this.buffer) this.line(this.buffer.replace(/\r$/, ""));
      this.line("");
    } else if (!this.overflow && this.buffer) {
      this.payload(this.buffer, "");
    }
  }
}

export function pipeUpstream(
  url: URL,
  method: string,
  headers: http.OutgoingHttpHeaders,
  body: Buffer | undefined,
  incoming: IncomingMessage,
  outgoing: http.ServerResponse,
  observer?: ResponseObserver,
): void {
  const opts: RequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method,
    headers,
  };
  const transport = url.protocol === "http:" ? http : https;
  const started = performance.now();
  let status: number | undefined;
  let settled = false;
  let metadata: ResponseMetadata | undefined;
  function complete(outcome: RequestOutcome["outcome"]): void {
    if (settled) return;
    settled = true;
    try {
      observer?.onComplete?.({ outcome, status, latency_ms: Math.round(performance.now() - started), usage: metadata?.usage });
    } catch {
      // A telemetry observer must not affect delivery.
    }
  }
  const req = transport.request(opts, (up) => {
    status = up.statusCode;
    const outHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(up.headers)) {
      if (!value) continue;
      if (["connection", "keep-alive", "transfer-encoding"].includes(key.toLowerCase())) continue;
      outHeaders[key] = value;
    }
    outgoing.writeHead(up.statusCode || 502, outHeaders);
    if (observer) {
      const contentType = up.headers["content-type"] ?? "";
      const encoding = up.headers["content-encoding"]?.toLowerCase().trim();
      const streamed = contentType.includes("text/event-stream");
      const decoder = responseDecoder(encoding);
      const observed = decoder ?? up;
      if (decoder || !encoding || encoding === "identity") {
        metadata = new ResponseMetadata(streamed, observer.onResponseId);
        observed.on("data", (chunk: Buffer) => metadata?.add(chunk));
      }
      const observeEnd = () => {
        metadata?.finish();
        complete(status && status >= 200 && status < 300 ? metadata?.outcome ?? "incomplete" : "failed");
      };
      observed.on("end", observeEnd);
      if (decoder) {
        decoder.on("error", () => {
          // Failure to decode metadata leaves the original response pipe intact.
          metadata = undefined;
          up.once("end", observeEnd);
          if (up.readableEnded) observeEnd();
        });
        up.on("close", () => {
          if (!up.complete) decoder.destroy();
        });
        up.pipe(decoder);
      }
    }
    up.on("error", () => {
      complete("failed");
      outgoing.destroy();
    });
    outgoing.once("close", () => {
      if (!outgoing.writableFinished) up.destroy();
    });
    up.pipe(outgoing);
  });
  req.on("error", (err) => {
    complete("failed");
    if (outgoing.destroyed) return;
    if (outgoing.headersSent) {
      outgoing.end();
      return;
    }
    outgoing.writeHead(502, { "content-type": "text/plain" });
    outgoing.end(`sift upstream error: ${err.message}`);
  });
  const cancel = () => {
    complete("canceled");
    req.destroy();
  };
  incoming.once("aborted", cancel);
  outgoing.once("close", () => {
    if (!outgoing.writableFinished) cancel();
  });
  if (outgoing.destroyed || incoming.aborted) {
    cancel();
    return;
  }
  if (body) req.write(body);
  req.end();
}
