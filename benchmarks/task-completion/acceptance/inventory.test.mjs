import assert from "node:assert/strict";
import { test } from "node:test";
import { Inventory } from "./inventory.mjs";
import { move } from "./transfer.mjs";

test("concurrent overlapping moves preserve all stock and reject overselling", async () => {
  const stock = new Inventory({ a: 10, b: 0, c: 2 });
  const outcomes = await Promise.allSettled([
    move(stock, "a", "b", 7),
    move(stock, "a", "c", 7),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((result) => result.status === "rejected").reason.message, "insufficient stock");
  assert.equal(await stock.read("a"), 3);
  assert.equal(await stock.read("b") + await stock.read("c"), 9);

  const crossing = new Inventory({ a: 10, b: 10 });
  await Promise.all([move(crossing, "a", "b", 6), move(crossing, "b", "a", 4)]);
  assert.equal(await crossing.read("a"), 8);
  assert.equal(await crossing.read("b"), 12);
});

test("failed credit leaves both bins intact and later moves can succeed", async () => {
  const stock = new Inventory({ a: 9, b: 1 });
  stock.setUnavailable("b");
  await assert.rejects(move(stock, "a", "b", 5), { message: "bin unavailable: b" });
  assert.equal(await stock.read("a"), 9);
  assert.equal(await stock.read("b"), 1);
  stock.setUnavailable("b", false);
  await move(stock, "a", "b", 5);
  assert.equal(await stock.read("a"), 4);
  assert.equal(await stock.read("b"), 6);
});

test("invalid amounts fail and a same-bin transfer is a no-op", async () => {
  const stock = new Inventory({ a: 4, b: 2 });
  for (const amount of [0, -3, 0.5, NaN, Infinity, "1", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(move(stock, "a", "b", amount));
  }
  stock.setUnavailable("a");
  await move(stock, "a", "a", 2);
  assert.equal(await stock.read("a"), 4);
  assert.equal(await stock.read("b"), 2);
});
