import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultLaneIndexes, formatModelMenu, listVisibleModels, parsePick } from "./menu.js";
import { applyLanePicks, loadPolicy, saveUserPolicy } from "./policy.js";

const models = listVisibleModels({
  models: [
    { slug: "gpt-6-astra", display_name: "GPT-6-Astra", description: "flagship", visibility: "list", priority: 1 },
    { slug: "gpt-5.6-sol", display_name: "GPT-5.6-Sol", description: "hard", visibility: "list", priority: 6 },
    { slug: "gpt-5.6-terra", display_name: "GPT-5.6-Terra", description: "everyday", visibility: "list", priority: 7 },
    { slug: "gpt-5.6-luna", display_name: "GPT-5.6-Luna", description: "cheap", visibility: "list", priority: 8 },
    { slug: "codex-auto-review", display_name: "Review", visibility: "hide", priority: 43 },
  ],
});

test("menu lists visible models with numbers", () => {
  assert.deepEqual(
    models.map((m) => m.slug),
    ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
  );
  const menu = formatModelMenu(models);
  assert.match(menu, /1\. GPT-6-Astra/);
  assert.match(menu, /4\. GPT-5\.6-Luna/);
});

test("defaults map luna/terra/sol without typing slugs", () => {
  assert.deepEqual(defaultLaneIndexes(models), { flash: 4, craft: 3, forge: 2 });
});

test("picks 4/3/2 write those models into the policy", () => {
  const policy = applyLanePicks(loadPolicy(), models, { flash: 4, craft: 3, forge: 2 });
  assert.equal(policy.lanes.flash.model, "gpt-5.6-luna");
  assert.equal(policy.lanes.craft.model, "gpt-5.6-terra");
  assert.equal(policy.lanes.forge.model, "gpt-5.6-sol");
});

test("parsePick accepts a number or the default", () => {
  assert.equal(parsePick("", 4, 3), 3);
  assert.equal(parsePick("1", 4, 3), 1);
  assert.throws(() => parsePick("9", 4, 3));
});

test("saveUserPolicy writes chosen lanes", () => {
  const prev = process.env.SIFT_HOME;
  process.env.SIFT_HOME = mkdtempSync(join(tmpdir(), "codex-sift-setup-"));
  try {
    const policy = applyLanePicks(loadPolicy(), models, { flash: 4, craft: 3, forge: 1 });
    const path = saveUserPolicy(policy);
    const text = readFileSync(path, "utf8");
    assert.match(text, /gpt-5\.6-luna/);
    assert.match(text, /gpt-6-astra/);
  } finally {
    if (prev === undefined) delete process.env.SIFT_HOME;
    else process.env.SIFT_HOME = prev;
  }
});
