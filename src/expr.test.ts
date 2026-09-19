import assert from "node:assert/strict";
import test from "node:test";
import { evalWhen } from "./expr.js";

test("comparisons, and, or, in-lists", () => {
  const v = { difficulty: 2.4, high_stakes: 0.2, task_kind: "ask", confidence: 0.9 };
  assert.equal(evalWhen("difficulty >= 2.2", v), true);
  assert.equal(evalWhen("high_stakes > 0.7", v), false);
  assert.equal(evalWhen("task_kind in [ask, ops] and difficulty < 1.2", v), false);
  assert.equal(evalWhen("task_kind in [ask, ops] and confidence > 0.5", v), true);
  assert.equal(evalWhen("high_stakes > 0.7 or difficulty >= 2.2", v), true);
  assert.equal(evalWhen("true", v), true);
  assert.equal(evalWhen("task_kind == ask", v), true);
  assert.equal(
    evalWhen("needs_planning > 0.7 and cross_cutting > 0.6", {
      ...v,
      needs_planning: 0.1,
      cross_cutting: 0.1,
    }),
    false,
  );
});
