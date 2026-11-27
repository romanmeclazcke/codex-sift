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
    'API_KEY="another secret with spaces"',
    '{"token": "a secret in JSON"}',
    "mongodb+srv://user:anotherpassword@example.test/db",
    "https://user:secretpath@example.test",
    "OPENAI_API_KEY=local-test-key",
    "AWS_SECRET_ACCESS_KEY=local-test-secret",
  ].join("\n");
  const out = redact(input);
  assert.equal(out.includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(out.includes("ts_abcdefghijk"), false);
  assert.equal(out.includes("ghp_abcdefghijklmnopqrstuvwxyz123"), false);
  assert.match(out, /redacted/);
  assert.equal(out.includes("postgres://user:pass@host/db"), false);
  assert.equal(out.includes("supersecretvalue"), false);
  assert.equal(out.includes("another secret with spaces"), false);
  assert.equal(out.includes("a secret in JSON"), false);
  assert.equal(out.includes("anotherpassword"), false);
  assert.equal(out.includes("secretpath"), false);
  assert.equal(out.includes("local-test-key"), false);
  assert.equal(out.includes("local-test-secret"), false);
});
