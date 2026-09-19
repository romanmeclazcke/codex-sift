import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPolicy } from "./policy.js";
import { startProxy } from "./proxy.js";

function listen(handler: http.RequestListener): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("bind failed");
      resolve({ server, origin: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test("proxy rewrites sift model before forwarding a user turn", async () => {
  const prevKey = process.env.TYPESAFE_API_KEY;
  const prevHome = process.env.SIFT_HOME;
  const prevOrigin = process.env.SIFT_OPENAI_ORIGIN;
  delete process.env.TYPESAFE_API_KEY;
  process.env.SIFT_HOME = mkdtempSync(join(tmpdir(), "codex-sift-"));
  const seen: Array<{ url?: string; model?: string }> = [];
  const upstream = await listen((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      let model: string | undefined;
      try {
        model = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}").model;
      } catch {
        model = undefined;
      }
      seen.push({ url: req.url, model });
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end('event: response.completed\ndata: {"type":"response.completed"}\n\n');
    });
  });
  process.env.SIFT_OPENAI_ORIGIN = upstream.origin;
  const policy = loadPolicy();
  const proxy = await startProxy(policy);
  try {
    const res = await fetch(`${proxy.url}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "sift",
        input: [{ role: "user", content: [{ type: "input_text", text: "what does package.json do?" }] }],
      }),
    });
    assert.equal(res.ok, true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, "/v1/responses");
    assert.notEqual(seen[0].model, "sift");
    assert.ok(seen[0].model === "gpt-5.6-luna" || seen[0].model === "gpt-5.6-terra" || seen[0].model === "gpt-5.6-sol");
  } finally {
    await new Promise<void>((r) => proxy.server.close(() => r()));
    await new Promise<void>((r) => upstream.server.close(() => r()));
    if (prevKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = prevKey;
    if (prevHome === undefined) delete process.env.SIFT_HOME;
    else process.env.SIFT_HOME = prevHome;
    if (prevOrigin === undefined) delete process.env.SIFT_OPENAI_ORIGIN;
    else process.env.SIFT_OPENAI_ORIGIN = prevOrigin;
  }
});
