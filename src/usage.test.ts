import assert from "node:assert/strict";
import test from "node:test";
import { loadPolicy } from "./policy.js";
import { summarizeUsage } from "./usage.js";

test("a mixed day shows savings versus always-forge", () => {
  const policy = loadPolicy();
  const summary = summarizeUsage(policy, [
    { lane: "flash", model: "gpt-5.6-luna", effort: "low" },
    { lane: "flash", model: "gpt-5.6-luna", effort: "low" },
    { lane: "flash", model: "gpt-5.6-luna", effort: "low" },
    { lane: "craft", model: "gpt-5.6-terra", effort: "medium" },
    { lane: "craft", model: "gpt-5.6-terra", effort: "medium" },
    { lane: "forge", model: "gpt-5.6-sol", effort: "high" },
  ]);
  assert.equal(summary.liveTurns, 6);
  assert.ok(summary.savedPct > 40);
  assert.ok(summary.actual < summary.alwaysForge);
});

test("degraded turns are excluded from the savings claim", () => {
  const policy = loadPolicy();
  const summary = summarizeUsage(policy, [
    { lane: "craft", model: "gpt-5.6-terra", effort: "medium", degraded: true },
    { lane: "flash", model: "gpt-5.6-luna", effort: "low" },
  ]);
  assert.equal(summary.degraded, 1);
  assert.equal(summary.liveTurns, 1);
});
