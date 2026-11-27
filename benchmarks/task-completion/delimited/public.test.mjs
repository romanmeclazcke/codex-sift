import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRow } from "./row.mjs";

test("unquoted columns preserve whitespace and empty fields", () => {
  assert.deepEqual(parseRow("a, b,,"), ["a", " b", "", ""]);
  assert.deepEqual(parseRow(""), [""]);
});
