import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { pipeUpstream, type RequestOutcome } from "./upstream.js";

async function listen(server: http.Server): Promise<URL> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
}

async function proxy(upstream: http.Server, run: (url: URL, outcomes: RequestOutcome[], responseIds: string[]) => Promise<void>) {
  const target = await listen(upstream);
  const outcomes: RequestOutcome[] = [];
  const responseIds: string[] = [];
  const server = http.createServer((req, res) => {
    pipeUpstream(target, "GET", {}, undefined, req, res, {
      onResponseId: (id) => responseIds.push(id),
      onComplete: (outcome) => outcomes.push(outcome),
    });
  });
  try {
    await run(await listen(server), outcomes, responseIds);
  } finally {
    server.close();
    server.closeAllConnections();
    upstream.close();
    upstream.closeAllConnections();
  }
}

test("SSE is forwarded before completion and reports metadata from split events", { timeout: 5000 }, async () => {
  const first = 'event: response.created\r\ndata: {"response":{"id":"resp_first"}}\r\n\r\n';
  const last = 'data: {"type":"response.completed","response":{"id":"resp_first","usage":{"input_tokens":24,"output_tokens":2,"total_tokens":26,"input_tokens_details":{"cached_tokens":8},"output_tokens_details":{"reasoning_tokens":0}}}}\n\n';
  let upstreamResponse: http.ServerResponse;
  const upstream = http.createServer((_req, res) => {
    upstreamResponse = res;
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(first.slice(0, 33));
    setImmediate(() => res.write(first.slice(33)));
  });

  await proxy(upstream, async (url, outcomes, responseIds) => {
    const res = await fetch(url);
    const reader = res.body!.getReader();
    let content = "";
    while (content.length < first.length) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      content += Buffer.from(chunk.value!).toString("utf8");
    }
    assert.equal(content, first);
    assert.deepEqual(responseIds, ["resp_first"]);
    assert.equal(outcomes.length, 0);
    upstreamResponse.end(last);
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      content += Buffer.from(chunk.value).toString("utf8");
    }
    assert.equal(content, first + last);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].outcome, "completed");
    assert.deepEqual(outcomes[0].usage, {
      input_tokens: 24, output_tokens: 2, total_tokens: 26, cached_input_tokens: 8, reasoning_tokens: 0,
    });
  });
});

test("compressed JSON metadata is observed without changing the response bytes", { timeout: 5000 }, async () => {
  const data = gzipSync('{"id":"resp_json","status":"failed","usage":{"output_tokens":7}}');
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip", "content-length": data.length });
    res.end(data);
  });
  await proxy(upstream, async (url, outcomes, responseIds) => {
    await new Promise<void>((resolve, reject) => {
      http.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          assert.equal(res.headers["content-encoding"], "gzip");
          assert.deepEqual(Buffer.concat(chunks), data);
          resolve();
        });
      }).on("error", reject);
    });
    while (!outcomes.length) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(responseIds, ["resp_json"]);
    assert.equal(outcomes[0].outcome, "failed");
    assert.equal(outcomes[0].usage?.output_tokens, 7);
  });
});

test("200 responses with malformed or oversized JSON have incomplete outcomes", { timeout: 5000 }, async () => {
  let body = "{";
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  await proxy(upstream, async (url, outcomes) => {
    assert.equal(await (await fetch(url)).text(), body);
    body = JSON.stringify({ id: "resp_large", status: "completed", output: "a".repeat(1024 * 1024) });
    assert.equal((await (await fetch(url)).arrayBuffer()).byteLength, body.length);
    assert.deepEqual(outcomes.map((result) => result.outcome), ["incomplete", "incomplete"]);
  });
});

test("downstream cancellation is recorded once and disconnects the upstream stream", { timeout: 5000 }, async () => {
  let upstreamClosed = false;
  const upstream = http.createServer((_req, res) => {
    res.on("close", () => { upstreamClosed = true; });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"type":"response.created","response":{"id":"resp_canceled"}}\n\n');
  });
  await proxy(upstream, async (url, outcomes) => {
    const client = new AbortController();
    const res = await fetch(url, { signal: client.signal });
    const reader = res.body!.getReader();
    assert.equal((await reader.read()).done, false);
    client.abort();
    while (!upstreamClosed) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(outcomes.map((result) => result.outcome), ["canceled"]);
  });
});
