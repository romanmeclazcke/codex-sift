import assert from "node:assert/strict";
import test from "node:test";
import { answersToSignals, JevUnavailable } from "./jev.js";

const answers = {
  task_kind: { type: "choice", choice: "debug", confidence: 0.81 },
  difficulty: { type: "score", score: 1.6, confidence: 0.7 },
  needs_reasoning: { type: "noul", noul: 0.88 },
  needs_planning: { type: "noul", noul: 0.4 },
  high_stakes: { type: "noul", noul: 0.1 },
  cross_cutting: { type: "noul", noul: 0.2 },
  is_chitchat: { type: "noul", noul: 0 },
};

test("maps Jev answers onto routing signals", () => {
  const signals = answersToSignals(answers, false);
  assert.equal(signals.task_kind, "debug");
  assert.equal(signals.difficulty, 1.6);
  assert.equal(signals.confidence, 0.7);
  assert.equal(signals.needs_reasoning, 0.88);
});

test("zero difficulty confidence is an abstention, not a panic", () => {
  const signals = answersToSignals({
    ...answers,
    task_kind: { type: "choice", choice: "ask", confidence: 0.86 },
    difficulty: { type: "score", score: 1.06, confidence: 0 },
    is_chitchat: { type: "noul", noul: 0.94 },
  }, false);
  assert.equal(signals.confidence, 0.86);
  assert.equal(signals.is_chitchat, 0.94);
});

test("rejects missing, malformed, and out-of-range routing signals", () => {
  for (const malformed of [
    {},
    { ...answers, task_kind: { ...answers.task_kind, choice: "constructor" } },
    { ...answers, task_kind: { ...answers.task_kind, confidence: null } },
    { ...answers, difficulty: { ...answers.difficulty, score: 3.01 } },
    { ...answers, difficulty: { ...answers.difficulty, score: NaN } },
    { ...answers, high_stakes: { type: "noul", noul: -0.1 } },
    { ...answers, is_chitchat: { type: "score", noul: 0.3 } },
  ]) {
    assert.throws(() => answersToSignals(malformed, false), JevUnavailable);
  }
});
