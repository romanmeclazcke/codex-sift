import assert from "node:assert/strict";
import test from "node:test";
import { assessEffectiveness } from "./effectiveness.js";
import { loadPolicy } from "./policy.js";

test("context effectiveness stays high with room to work", () => {
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 10000;
  const result = assessEffectiveness({ input: "x".repeat(1000) }, policy, 1);
  assert.equal(result.score, 100);
});

test("context effectiveness falls when large input leaves little room for growth", () => {
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 6000;
  const result = assessEffectiveness({ input: "x".repeat(20000) }, policy, 1);
  assert.ok(result.score < 40);
});

test("custom effective-context percentages shift the score onset", () => {
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 10000;
  policy.effectiveness.full_score_until_percent = 20;
  policy.effectiveness.max_pressure_at_percent = 80;
  const input = { input: "x".repeat(12000) };
  const custom = assessEffectiveness(input, policy, 1);
  policy.effectiveness.full_score_until_percent = 50;
  policy.effectiveness.max_pressure_at_percent = 95;
  const defaults = assessEffectiveness(input, policy, 1);
  assert.ok(custom.score < 100);
  assert.equal(defaults.score, 100);
});

test("a full window has no context headroom regardless of Jev's estimate", () => {
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 1000;
  const input = { input: "x".repeat(5000) };
  for (const growth of [0, 0.5, 1]) {
    const result = assessEffectiveness(input, policy, growth);
    assert.equal(result.tokenScore, 0);
    assert.equal(result.score, 0);
  }
});

test("Jev adjustment only lowers the token headroom score", () => {
  const policy = loadPolicy();
  policy.effectiveness.context_window_tokens = 1000;
  const input = { input: "x".repeat(3000) };
  const lowGrowth = assessEffectiveness(input, policy, 0);
  const highGrowth = assessEffectiveness(input, policy, 1);
  assert.ok(lowGrowth.tokenScore > 0 && lowGrowth.tokenScore < 100);
  assert.equal(lowGrowth.score, lowGrowth.tokenScore);
  assert.ok(highGrowth.score < highGrowth.tokenScore);
});
