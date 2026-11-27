import assert from "node:assert/strict";
import test from "node:test";
import { loadPolicy } from "./policy.js";
import { formatUsage, snapshotWeights, summarizeUsage } from "./usage.js";

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

test("estimates keep historical weights and signed savings for a custom baseline", () => {
  const policy = loadPolicy();
  const old = {
    ...policy,
    usage_weight: { "chosen-model": 3, "baseline-model": 1, "old-forge": 2 },
    lanes: { ...policy.lanes, forge: { model: "old-forge", effort: "medium" } },
  };
  const row = { lane: "craft", model: "chosen-model", weights: snapshotWeights(old) };
  const summary = summarizeUsage(policy, [row, { ...row, estimate: false }], { model: "baseline-model" });
  assert.equal(summary.estimatedTurns, 1);
  assert.equal(summary.actual, 3);
  assert.equal(summary.baselineUnits, 1);
  assert.equal(summary.savedPct, -200);
  assert.match(formatUsage(summary), /-2\.00 units \(-200\.0%\)/);
  const forge = summarizeUsage(policy, [row]);
  assert.equal(forge.baselineModel, "old-forge");
  assert.equal(forge.baselineUnits, 2);
});
