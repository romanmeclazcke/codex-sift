import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRow } from "./row.mjs";

test("quoted fields decode commas, doubled quotes and empty values", () => {
  assert.deepEqual(parseRow('a,"b,c","d""e","",'), ["a", "b,c", 'd"e', "", ""]);
  assert.deepEqual(parseRow('""""'), ['"']);
  assert.deepEqual(parseRow('"a"""," b ",c'), ['a"', " b ", "c"]);
});

test("malformed quoted fields reject with a syntax error", () => {
  for (const row of ['"unfinished', 'a"b,c', '"closed"extra,b', '"closed" ,b']) {
    assert.throws(() => parseRow(row), SyntaxError);
  }
});
