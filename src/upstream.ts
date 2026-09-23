import http from "node:http";
import https from "node:https";
import type { IncomingMessage, RequestOptions } from "node:http";
import type { Transform } from "node:stream";
import { URL } from "node:url";

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

export function pipeUpstream(
  url: URL,
  method: string,
  headers: http.OutgoingHttpHeaders,
  body: Buffer | undefined,
  incoming: IncomingMessage,
  outgoing: http.ServerResponse,
  transform?: (headers: http.OutgoingHttpHeaders) => Transform | undefined,
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
  const req = transport.request(opts, (up) => {
    const outHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(up.headers)) {
      if (!value) continue;
      if (["connection", "keep-alive", "transfer-encoding"].includes(key.toLowerCase())) continue;
      outHeaders[key] = value;
    }
    const body = transform?.(outHeaders);
    if (body) {
      delete outHeaders["content-length"];
      delete outHeaders.etag;
      delete outHeaders["content-md5"];
      delete outHeaders.digest;
    }
    outgoing.writeHead(up.statusCode || 502, outHeaders);
    if (body) {
      body.on("error", (err) => outgoing.destroy(err));
      up.pipe(body).pipe(outgoing);
    } else {
      up.pipe(outgoing);
    }
  });
  req.on("error", (err) => {
    if (outgoing.headersSent) {
      outgoing.end();
      return;
    }
    outgoing.writeHead(502, { "content-type": "text/plain" });
    outgoing.end(`sift upstream error: ${err.message}`);
  });
  incoming.on("aborted", () => req.destroy());
  if (body) req.write(body);
  req.end();
}
