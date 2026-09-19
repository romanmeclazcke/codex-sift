import assert from "node:assert/strict";
import test from "node:test";
import { isNewUserTurn, lastUserText, rewriteModel } from "./turns.js";

test("extracts Responses user text from nested content", () => {
  const body = {
    model: "sift",
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "rename the helper" }],
      },
    ],
  };
  assert.equal(lastUserText(body), "rename the helper");
  assert.equal(isNewUserTurn(body), true);
});

test("tool-loop continuations are not new user turns", () => {
  const body = {
    model: "sift",
    input: [
      { role: "user", content: "fix the test" },
      { type: "function_call_output", output: "ok" },
    ],
  };
  assert.equal(isNewUserTurn(body), false);
});

test("auto-review is auxiliary", () => {
  const body = {
    model: "codex-auto-review",
    input: [{ role: "user", content: "review this diff" }],
  };
  assert.equal(isNewUserTurn(body), false);
});

test("rewriteModel sets model and effort", () => {
  const next = rewriteModel({ model: "sift", input: [] }, "gpt-5.6-luna", "low");
  assert.equal(next.model, "gpt-5.6-luna");
  assert.deepEqual(next.reasoning, { effort: "low" });
});
