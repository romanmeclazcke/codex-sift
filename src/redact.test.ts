import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "./redact.js";

test("redacts keys, tokens, and connection strings", () => {
  const input = [
    "sk-abcdefghijklmnopqrstuvwxyz",
    "ts_abcdefghijk",
    "ghp_abcdefghijklmnopqrstuvwxyz123",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc",
    "postgres://user:pass@host/db",
    "API_KEY=supersecretvalue",
  ].join("\n");
  const out = redact(input);
  assert.equal(out.includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(out.includes("ts_abcdefghijk"), false);
  assert.equal(out.includes("ghp_abcdefghijklmnopqrstuvwxyz123"), false);
  assert.match(out, /redacted/);
  assert.equal(out.includes("postgres://user:pass@host/db"), false);
  assert.equal(out.includes("supersecretvalue"), false);
});
