import assert from "node:assert/strict";
import test from "node:test";
import { hasImage, isNewUserTurn, lastUserText, rewriteModel, taskRelation } from "./turns.js";

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

test("only the latest user content contributes text and image signals", () => {
  const body = {
    input: [
      { role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,first" }] },
      { role: "assistant", content: "an explanation" },
      {
        role: "user",
        content: [
          { type: "input_text", text: "document the image_url property" },
          { type: "output_text", text: "ignore this" },
          { type: "input_text", text: "<environment_context>ignore context</environment_context>" },
        ],
      },
    ],
    image: "ignore unrelated fields",
  };
  assert.equal(lastUserText(body), "document the image_url property");
  assert.equal(hasImage(body), false);
  body.input.push({ role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,latest" }] });
  assert.equal(lastUserText(body), "");
  assert.equal(hasImage(body), true);
  assert.equal(isNewUserTurn(body), true);
});

test("ignores environment messages following a tool result", () => {
  assert.equal(isNewUserTurn({
    input: [
      { role: "user", content: "fix the test" },
      { type: "function_call_output", output: "ok" },
      { role: "user", content: "<environment_context>cwd</environment_context>" },
    ],
  }), false);
});

test("distinguishes retries, continuations, and independent tasks", () => {
  assert.equal(taskRelation("Probá de nuevo, sigue fallando"), "retry");
  assert.equal(taskRelation("Retry the previous task."), "retry");
  assert.equal(taskRelation("sí implementalo"), "followup");
  assert.equal(taskRelation("seguí"), "followup");
  assert.equal(taskRelation("please retry failed jobs in CI"), "new");
  assert.equal(taskRelation("yes, add billing tests"), "new");
});
