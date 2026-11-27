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

test("classifies user tasks, redacts follow-up context, and preserves the route across response IDs", async (t) => {
  const originalEnv = { ...process.env };
  const states: Array<Record<string, unknown>> = [];
  const forwarded: Array<Record<string, unknown>> = [];
  const upstream = await listen(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (req.url === "/v1/systemone") {
      states.push(body.state);
      const task = body.state.task;
      const talk = task === "hello";
      res.setHeader("content-type", "application/json");
      if (task === "invalid classification") {
        res.end(JSON.stringify({ answers: {} }));
        return;
      }
      res.end(JSON.stringify({
        answers: {
          task_kind: { type: "choice", choice: talk ? "ask" : "edit", confidence: 0.9 },
          difficulty: { type: "score", score: talk ? 0.2 : 2.9, confidence: 0.9 },
          needs_reasoning: { type: "noul", noul: 0.1 },
          needs_planning: { type: "noul", noul: 0.1 },
          high_stakes: { type: "noul", noul: 0.1 },
          cross_cutting: { type: "noul", noul: 0.1 },
          is_chitchat: { type: "noul", noul: talk ? 0.9 : 0.1 },
        },
      }));
      return;
    }
    forwarded.push(body);
    const id = "resp_" + forwarded.length;
    if (forwarded.length === 2) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id, status: "completed" }));
      return;
    }
    res.setHeader("content-type", "text/event-stream");
    for (const type of ["response.created", "response.completed"]) {
      res.write("event: " + type + "\ndata: " + JSON.stringify({ type, response: { id } }) + "\n\n");
    }
    res.end();
  });
  t.after(() => new Promise<void>((resolve) => upstream.server.close(() => resolve())));
  process.env.TYPESAFE_BASE_URL = upstream.origin;
  process.env.TYPESAFE_API_KEY = "test-key";
  process.env.SIFT_OPENAI_ORIGIN = upstream.origin;
  process.env.SIFT_HOME = mkdtempSync(join(tmpdir(), "codex-sift-"));
  t.after(() => { process.env = originalEnv; });
  const policy = loadPolicy();
  const proxy = await startProxy(policy);
  t.after(() => new Promise<void>((resolve) => proxy.server.close(() => resolve())));

  async function respond(input: unknown, headers: Record<string, string> = {}, previous?: string, model = "sift") {
    const response = await fetch(proxy.url + "/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ model, input, previous_response_id: previous }),
    });
    assert.equal(response.status, 200);
    await response.text();
  }

  await respond("hello", { "session-id": "test-session" });
  const design = "Design the query index for password=SyntheticSecret and " + "x".repeat(600);
  await respond(design, { "session-id": "test-session" });
  await respond([{ type: "function_call_output", output: "tool output" }], {}, "resp_2");
  await respond([{ type: "function_call_output", output: "second tool output" }], {}, "resp_3");
  await respond("sí implementalo", {}, "resp_4");
  await respond("seguí", {}, "resp_5");
  await respond("probá de nuevo", {}, "resp_6");
  await respond("invalid classification", {}, "resp_7");
  await respond("explicit model", {}, undefined, "manual-model");
  const codexTurn = (id: string) => ({
    "x-codex-turn-metadata": JSON.stringify({ thread_id: "thread", session_id: "session", turn_id: id }),
  });
  await respond("hello", codexTurn("first"));
  await respond("hello", codexTurn("first"));
  await respond("hello", codexTurn("second"));

  assert.equal(states.length, 8);
  assert.deepEqual(states[1], {
    task: design.replace("password=SyntheticSecret", "password=[redacted]"),
    has_image: false,
    retry: false,
    previous_lane: null,
  });
  assert.equal(states[2].task, "sí implementalo");
  assert.equal(states[2].retry, false);
  assert.equal(states[2].previous_lane, "forge");
  const context = states[2].previous_task;
  assert.equal(typeof context, "string");
  assert.ok(String(context).startsWith("Design the query index for password=[redacted]"));
  assert.ok(String(context).endsWith("[truncated]"));
  assert.equal(states[3].previous_task, context);
  assert.equal(states[3].retry, false);
  assert.equal(states[4].previous_task, context);
  assert.equal(states[4].retry, true);
  assert.deepEqual(forwarded.map(({ model }) => model), [
    policy.lanes.flash.model,
    ...Array(6).fill(policy.lanes.forge.model),
    policy.lanes[policy.on_jev_down].model,
    "manual-model",
    ...Array(3).fill(policy.lanes.flash.model),
  ]);
});
