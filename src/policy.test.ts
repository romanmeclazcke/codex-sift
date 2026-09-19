import assert from "node:assert/strict";
import test from "node:test";
import { applyPolicy, fallbackSignals, loadPolicy } from "./policy.js";
import type { Signals } from "./types.js";

function signals(partial: Partial<Signals>): Signals {
  return {
    task_kind: "edit",
    task_kind_confidence: 0.8,
    difficulty: 1,
    difficulty_confidence: 0.8,
    needs_reasoning: 0.1,
    needs_planning: 0.1,
    high_stakes: 0.1,
    cross_cutting: 0.1,
    confidence: 0.8,
    has_image: false,
    ...partial,
  };
}

test("bundled policy sends hard and high-stakes work to forge", () => {
  const policy = loadPolicy();
  const hard = applyPolicy(policy, signals({ difficulty: 2.5 }));
  assert.equal(hard.lane, "forge");
  assert.equal(hard.model, "gpt-5.6-sol");
  const stakes = applyPolicy(policy, signals({ high_stakes: 0.9, difficulty: 0.4 }));
  assert.equal(stakes.lane, "forge");
});

test("bundled policy sends short asks to flash", () => {
  const policy = loadPolicy();
  const ask = applyPolicy(policy, signals({ task_kind: "ask", difficulty: 0.5 }));
  assert.equal(ask.lane, "flash");
  assert.equal(ask.model, "gpt-5.6-luna");
});

test("low Jev confidence escalates", () => {
  const policy = loadPolicy();
  const unsure = applyPolicy(policy, signals({ confidence: 0.2, difficulty: 0.2, task_kind: "ask" }));
  assert.equal(unsure.lane, "forge");
});

test("localized edits stay on flash", () => {
  const policy = loadPolicy();
  const edit = applyPolicy(policy, signals({ task_kind: "edit", difficulty: 0.8, high_stakes: 0.1 }));
  assert.equal(edit.lane, "flash");
});

test("offline fallback heuristic flags architecture-ish prompts as harder", () => {
  const s = fallbackSignals("redesign auth across the billing service", false);
  assert.equal(s.task_kind, "edit");
  assert.ok(s.difficulty >= 2);
  assert.ok(s.high_stakes > 0.5);
});
