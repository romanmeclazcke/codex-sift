import assert from "node:assert/strict";
import { test } from "node:test";
import * as products from "./products.mjs";
import { productLabel } from "./catalog.mjs";

test("the renamed export preserves hits and misses and feeds catalog labels", () => {
  assert.equal(Object.hasOwn(products, "findProduct"), false);
  assert.deepEqual(products.getProduct("p01"), { sku: "p01", name: "Filter", price: 18 });
  assert.equal(products.getProduct("P01"), undefined);
  assert.equal(productLabel("p02"), "Carafe ($24)");
});
