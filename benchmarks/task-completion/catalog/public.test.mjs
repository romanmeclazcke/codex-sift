import assert from "node:assert/strict";
import { test } from "node:test";
import { productLabel } from "./catalog.mjs";

test("catalog labels preserve formatting and handle missing products", () => {
  assert.equal(productLabel("p01"), "Filter ($18)");
  assert.equal(productLabel("missing"), "Product unavailable");
});
