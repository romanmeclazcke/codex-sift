import assert from "node:assert/strict";
import { test } from "node:test";
import { Inventory } from "./inventory.mjs";
import { move } from "./transfer.mjs";

test("successful transfers debit and credit the correct bins", async () => {
  const stock = new Inventory({ a: 8, b: 3 });
  await move(stock, "a", "b", 5);
  assert.equal(await stock.read("a"), 3);
  assert.equal(await stock.read("b"), 8);
  await assert.rejects(move(stock, "a", "b", 9), { message: "insufficient stock" });
});
