import assert from "node:assert/strict";
import test from "node:test";
import { injectVirtualModel } from "./catalog.js";
import { loadPolicy } from "./policy.js";

test("injects Sift at the front of a Codex catalog", () => {
  const policy = loadPolicy();
  const catalog = injectVirtualModel(
    {
      models: [
        {
          slug: "gpt-5.6-terra",
          display_name: "GPT-5.6-Terra",
          description: "balanced",
          visibility: "list",
          supported_in_api: true,
          priority: 7,
          shell_type: "unified_exec",
        },
      ],
    },
    policy,
  );
  assert.equal(catalog.models[0].slug, "sift");
  assert.equal(catalog.models[0].display_name, "Sift");
  assert.equal(catalog.models[0].priority, 0);
  assert.equal(catalog.models[1].slug, "gpt-5.6-terra");
});
