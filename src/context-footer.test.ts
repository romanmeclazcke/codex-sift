import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { assessEffectiveness } from "./effectiveness.js";
import { loadPolicy } from "./policy.js";
import { startProxy } from "./proxy.js";

function listen(handler: http.RequestListener): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("bind failed");
    resolve({ server, origin: `http://127.0.0.1:${address.port}` });
  }));
}

test("low context score never pauses execution and footer includes response text", async () => {
  const saved = {
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
    TYPESAFE_BASE_URL: process.env.TYPESAFE_BASE_URL,
    SIFT_OPENAI_ORIGIN: process.env.SIFT_OPENAI_ORIGIN,
    SIFT_HOME: process.env.SIFT_HOME,
  };
  process.env.TYPESAFE_API_KEY = "test-key";
  process.env.SIFT_HOME = mkdtempSync(join(tmpdir(), "codex-sift-context-"));
  const jev = await listen((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const answers = body.questions.needs_more_context
        ? { needs_more_context: { noul: 1, confidence: 1 } }
        : { task_kind: { choice: "edit", confidence: 1 }, difficulty: { score: 1, confidence: 1 } };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ answers }));
    });
  });
  process.env.TYPESAFE_BASE_URL = jev.origin;
  const forwarded: Array<Record<string, unknown>> = [];
  const output = "y".repeat(800);
  const events = `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", item_id: "msg_1", output_index: 0, content_index: 0, delta: output })}\n\nevent: response.output_text.done\ndata: ${JSON.stringify({ type: "response.output_text.done", item_id: "msg_1", output_index: 0, content_index: 0, text: output })}\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n`;
  const upstream = await listen((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      forwarded.push(request);
      const task = (request.input as Array<{ content: string }>)[0]?.content;
      if (task === "json-response") {
        const json = JSON.stringify({ message: "café" });
        res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(json) });
        res.end(json);
      } else if (task === "gzip-response") {
        const compressed = gzipSync(events);
        res.writeHead(200, { "content-type": "text/event-stream", "content-encoding": "gzip", "content-length": compressed.length });
        res.end(compressed);
      } else {
        res.writeHead(200, { "content-type": "text/event-stream", "content-length": Buffer.byteLength(events) });
        res.end(events);
      }
    });
  });
  process.env.SIFT_OPENAI_ORIGIN = upstream.origin;
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 1500;
  const proxy = await startProxy(policy);
  const post = async (task: string) => {
    const request = { model: "sift", stream: true, input: [{ role: "user", content: task }] };
    const response = await fetch(`${proxy.url}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    return {
      request,
      status: response.status,
      contentLength: response.headers.get("content-length"),
      contentEncoding: response.headers.get("content-encoding"),
      text: await response.text(),
    };
  };
  try {
    const crowded = await post("x".repeat(10000));
    assert.equal(crowded.status, 200);
    assert.equal(forwarded.length, 1);
    assert.equal(crowded.contentLength, null);
    assert.match(crowded.text, /Estimated context after response: \d+% used/);
    assert.match(crowded.text, /Token headroom: 0%/);
    assert.doesNotMatch(crowded.text, /continuar|cancelar/);

    const moderate = await post("x".repeat(3000));
    assert.equal(moderate.status, 200);
    assert.equal(forwarded.length, 2);
    const before = assessEffectiveness(moderate.request, policy, 1).tokenScore;
    const after = Number(moderate.text.match(/Token headroom: (\d+)%/)?.[1]);
    assert.ok(Number.isFinite(after));
    assert.ok(after < before, `expected post-response score ${after} to be below input-only score ${before}`);
    assert.match(moderate.text, /Task-adjusted headroom \(Jev\): \d+%/);

    const json = await post("json-response");
    assert.equal(json.text, JSON.stringify({ message: "café" }));
    assert.equal(json.contentLength, String(Buffer.byteLength(json.text)));
    assert.doesNotMatch(json.text, /Model used:/);

    const compressed = await post("gzip-response");
    assert.equal(compressed.contentEncoding, "gzip");
    assert.equal(compressed.text, events);
    assert.doesNotMatch(compressed.text, /Model used:/);
  } finally {
    await new Promise<void>((resolve) => proxy.server.close(() => resolve()));
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
    await new Promise<void>((resolve) => jev.server.close(() => resolve()));
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
