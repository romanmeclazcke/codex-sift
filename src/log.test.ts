import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { logPath, lastPath, readLast, readLog, writeDecision, writeOutcome } from "./log.js";
import { laneFromName, loadPolicy } from "./policy.js";
import { runReport } from "./report.js";

function withHome(run: (dir: string) => void): void {
  const oldHome = process.env.SIFT_HOME;
  const oldPreview = process.env.SIFT_LOG_PROMPT_PREVIEW;
  const home = mkdtempSync(join(tmpdir(), "sift-log-"));
  process.env.SIFT_HOME = home;
  delete process.env.SIFT_LOG_PROMPT_PREVIEW;
  try {
    run(home);
  } finally {
    if (oldHome === undefined) delete process.env.SIFT_HOME;
    else process.env.SIFT_HOME = oldHome;
    if (oldPreview === undefined) delete process.env.SIFT_LOG_PROMPT_PREVIEW;
    else process.env.SIFT_LOG_PROMPT_PREVIEW = oldPreview;
    rmSync(home, { recursive: true, force: true });
  }
}

test("telemetry is metadata-only by default and previews require an explicit opt-in", () => withHome(() => {
  const decision = laneFromName(loadPolicy(), "craft");
  const prompt = 'refactor this module with password="a phrase nobody should log"';
  writeDecision(decision, prompt);
  assert.equal(readLast()?.prompt_preview, undefined);
  assert.equal(readLog()[0].prompt_preview, undefined);
  assert.doesNotMatch(readFileSync(lastPath(), "utf8"), /refactor this module/);
  assert.equal(statSync(lastPath()).mode & 0o777, 0o600);
  assert.equal(statSync(logPath()).mode & 0o777, 0o600);

  process.env.SIFT_LOG_PROMPT_PREVIEW = "1";
  writeDecision(decision, prompt, { source: "preview" });
  assert.match(readLast()?.prompt_preview ?? "", /^refactor.*password=\[redacted\]$/);
  assert.doesNotMatch(readFileSync(lastPath(), "utf8"), /nobody should log/);
  assert.equal(readLog().length, 1);

  appendFileSync(logPath(), '{"at": incomplete\n');
  assert.equal(readLog().length, 1);
  writeFileSync(lastPath(), "{");
  assert.equal(readLast(), null);
}));

test("a telemetry filesystem failure warns once and leaves routing decisions usable", () => withHome((home) => {
  const obstruction = join(home, "file");
  writeFileSync(obstruction, "");
  process.env.SIFT_HOME = obstruction;
  const warning = process.emitWarning;
  const messages: string[] = [];
  process.emitWarning = (message) => { messages.push(String(message)); };
  try {
    const decision = laneFromName(loadPolicy(), "craft");
    assert.equal(writeDecision(decision, "a task").lane, "craft");
    writeOutcome({ session_id: "s", task_id: "t", request_kind: "initial", outcome: "completed", latency_ms: 1 });
    assert.equal(messages.length, 1);
  } finally {
    process.emitWarning = warning;
  }
}));

test("the session report groups requests, outcomes and token coverage without exposing prompt previews", () => withHome(() => {
  const policy = loadPolicy();
  const decision = laneFromName(policy, "craft");
  appendFileSync(logPath(), JSON.stringify({ ...decision, at: new Date().toISOString(), prompt_preview: "old private prompt" }) + "\n");
  writeDecision(decision, "older task", { policy, session_id: "older", task_id: "old" });
  for (const taskId of ["new-1", "new-2"]) {
    writeDecision(decision, "new private prompt", { policy, session_id: "newer", task_id: taskId });
  }
  writeOutcome({ session_id: "newer", task_id: "new-1", request_kind: "initial", outcome: "completed", latency_ms: 10, usage: { input_tokens: 12 } });
  writeOutcome({ session_id: "newer", task_id: "new-1", request_kind: "continuation", outcome: "failed", latency_ms: 30, status: 500 });
  writeOutcome({ session_id: "newer", task_id: "new-2", request_kind: "initial", outcome: "completed", latency_ms: 20, usage: { input_tokens: 5, output_tokens: 0 } });

  const write = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk) => { output += String(chunk); return true; };
  try {
    assert.equal(runReport(["--session=latest", "--json", "--baseline=gpt-5.6-luna", "--baseline-effort=low"]), 0);
    const result = JSON.parse(output);
    assert.deepEqual(result.session_ids, ["older", "newer"]);
    assert.equal(result.selected_session, "newer");
    assert.equal(result.summary.estimatedTurns, 1);
    assert.ok(result.summary.savedPct < 0);
    assert.deepEqual(result.lifecycle.tasks, { completed: 1, failed: 1, incomplete: 0, canceled: 0, unobserved: 0 });
    assert.deepEqual(result.lifecycle.measured_usage, {
      requests: 2, tokens: { input_tokens: 17, output_tokens: 0 }, token_coverage: { input_tokens: 2, output_tokens: 1 },
    });
    assert.equal(result.tasks[0].requests[1].status, 500);
    assert.equal(result.tasks[0].requests[1].kind, "continuation");
    assert.doesNotMatch(output, /private prompt/);
    output = "";
    assert.equal(runReport(["--json"]), 0);
    assert.equal(JSON.parse(output).lifecycle.legacy_decisions, 1);
  } finally {
    process.stdout.write = write;
  }
}));
