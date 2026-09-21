import assert from "node:assert/strict";
import test from "node:test";
import { answersToSignals } from "./jev.js";

test("maps Jev answers onto routing signals", () => {
  const signals = answersToSignals(
    {
      task_kind: { choice: "debug", confidence: 0.81 },
      difficulty: { score: 1.6, confidence: 0.7 },
      needs_reasoning: { noul: 0.88 },
      needs_planning: { noul: 0.4 },
      high_stakes: { noul: 0.1 },
      cross_cutting: { noul: 0.2 },
    },
    false,
  );
  assert.equal(signals.task_kind, "debug");
  assert.equal(signals.difficulty, 1.6);
  assert.equal(signals.confidence, 0.7);
  assert.equal(signals.needs_reasoning, 0.88);
});

test("zero difficulty confidence is an abstention, not a panic", () => {
  const signals = answersToSignals(
    {
      task_kind: { choice: "ask", confidence: 0.86 },
      difficulty: { score: 1.06, confidence: 0 },
      is_chitchat: { noul: 0.94 },
    },
    false,
  );
  assert.equal(signals.confidence, 0.86);
  assert.equal(signals.is_chitchat, 0.94);
});
