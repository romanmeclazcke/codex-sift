import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decideTurn } from "../dist/jev.js";
import { loadLocalEnv } from "../dist/env.js";
import { bundledPolicyPath, loadPolicyFile } from "../dist/policy.js";

loadLocalEnv();
const policy = loadPolicyFile(bundledPolicyPath());
const tasks = [
  { id: "lookup", manual: "flash", prompt: "In Node.js package.json, which scripts key does npm test execute? Return only the key name.", expected: "test" },
  { id: "javascript", manual: "craft", prompt: "What does this JavaScript expression evaluate to? [3, 1, 4].filter(n => n > 1).map(n => n * 2).join(','). Return only the resulting string, without quotes.", expected: "6,8" },
  { id: "async", manual: "forge", prompt: "What is the exact output of this JS snippet? const a = []; Promise.resolve().then(() => { a.push('A'); queueMicrotask(() => a.push('C')); }).then(() => a.push('D')); queueMicrotask(() => a.push('B')); setTimeout(() => console.log(a.join('')), 0); Return only the resulting string.", expected: "ABCD" },
];
const cwd = mkdtempSync(join(tmpdir(), "codex-sift-bench-"));
const rows = [];

try {
  for (const task of tasks) {
    const decision = await decideTurn(policy, task.prompt);
    for (const [strategy, lane] of [["fixed", "forge"], ["manual", task.manual], ["sift", decision.lane]]) {
      const { model, effort } = policy.lanes[lane];
      const started = performance.now();
      try {
        const output = execFileSync("codex", [
          "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
          "--skip-git-repo-check", "--sandbox", "read-only", "--json", "--model", model,
          "-c", `model_reasoning_effort="${effort}"`, task.prompt,
        ], { cwd, encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
        const events = output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        const usage = events.findLast((event) => event.type === "turn.completed")?.usage;
        const answer = events.findLast((event) => event.type === "item.completed" && event.item.type === "agent_message")?.item.text;
        rows.push({ task: task.id, strategy, model, effort, correct: answer?.trim() === task.expected,
          usage, seconds: Number(((performance.now() - started) / 1000).toFixed(2)),
          ...(strategy === "sift" && { degraded: decision.degraded, routing_ms: decision.jev_ms }) });
      } catch (error) {
        rows.push({ task: task.id, strategy, model, effort, error: error.code ?? error.status ?? "invalid output" });
      }
    }
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
console.log(JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));
