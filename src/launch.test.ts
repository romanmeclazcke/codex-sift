import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPolicyFile, bundledPolicyPath } from "./policy.js";

const policy = loadPolicyFile(bundledPolicyPath());

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sift-codex-probe-"));
  const bin = join(root, "codex");
  const codexHome = join(root, "custom-codex-home");
  mkdirSync(codexHome);
  writeFileSync(bin, `#!${process.execPath}
const args = process.argv.slice(2);
if (args[0] === "--version") console.log("codex-cli test");
else if (args[0] === "login" && args[1] === "status") {
  if (process.env.FAKE_AUTH === "missing") {
    console.error("Not logged in");
    process.exitCode = 1;
  } else if (process.env.FAKE_AUTH === "unsupported") {
    console.error("Unknown command");
    process.exitCode = 2;
  } else {
    console.error("Logged in using ChatGPT");
  }
} else if (args[0] === "debug" && args[1] === "models") {
  console.log(JSON.stringify({ models: JSON.parse(process.env.FAKE_MODELS) }));
} else console.log(JSON.stringify(args));
`, { mode: 0o755 });
  const env = { ...process.env };
  for (const name of [
    "OPENAI_API_KEY",
    "SIFT_POLICY",
    "SIFT_FORCE_LANE",
    "SIFT_DISABLED",
    "TYPESAFE_API_KEY",
  ]) delete env[name];
  Object.assign(env, {
    CODEX_BIN: bin,
    CODEX_HOME: codexHome,
    SIFT_HOME: join(root, "sift"),
    HOME: root,
    FAKE_MODELS: JSON.stringify(Object.values(policy.lanes).map(({ model }) => ({ slug: model }))),
  });
  return {
    root,
    codexHome,
    run(args: string[], overrides: NodeJS.ProcessEnv = {}) {
      return spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
        env: { ...env, ...overrides },
        encoding: "utf8",
      });
    },
  };
}

test("doctor distinguishes a missing executable or login from degraded Jev routing", () => {
  const { root, run } = fixture();
  const missing = run(["doctor"], { CODEX_BIN: join(root, "missing") });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /status: blocked/);
  assert.match(missing.stderr, /Install Codex or set CODEX_BIN/);

  const login = run(["doctor"], { FAKE_AUTH: "missing", TYPESAFE_API_KEY: "jev-test-key" });
  assert.equal(login.status, 1);
  assert.match(login.stderr, /Codex needs authentication/);

  const degraded = run(["doctor"], { FAKE_MODELS: JSON.stringify([{ slug: policy.lanes.flash.model }]) });
  assert.equal(degraded.status, 0);
  assert.match(degraded.stdout, /codex auth: ChatGPT \(codex login status\)/);
  assert.match(degraded.stdout, /status: degraded/);
  assert.match(degraded.stderr, /configured fallback lane/);
  assert.match(degraded.stderr, /Lane 'forge' model .* absent from/);

  const ready = run(["doctor"], { TYPESAFE_API_KEY: "jev-test-key" });
  assert.equal(ready.status, 0);
  assert.match(ready.stdout, /status: ready/);
  assert.doesNotMatch(ready.stdout + ready.stderr, /jev-test-key/);
});

test("doctor checks auth.json and config in CODEX_HOME when login status is unavailable", () => {
  const { codexHome, run } = fixture();
  writeFileSync(join(codexHome, "config.toml"), "");
  writeFileSync(join(codexHome, "auth.json"), JSON.stringify({
    OPENAI_API_KEY: null,
    tokens: { access_token: "mock-sensitive-token" },
  }));
  const result = run(["doctor"], { FAKE_AUTH: "unsupported", TYPESAFE_API_KEY: "jev-test-key" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /codex auth: ChatGPT in auth\.json/);
  assert.match(result.stdout, /codex config: found/);
  assert.doesNotMatch(result.stdout + result.stderr, /mock-sensitive-token/);
});

test("forced lane includes model and effort while explicit overrides take precedence", () => {
  const { run } = fixture();
  const { model, effort } = policy.lanes.forge;
  const forced = run(["--sift-lane=forge", "exec", "inspect"]);
  assert.equal(forced.status, 0);
  assert.deepEqual(JSON.parse(forced.stdout), [
    "-c", `model="${model}"`, "-c", `model_reasoning_effort="${effort}"`, "exec", "inspect",
  ]);

  const effortOverride = ["--config", 'model_reasoning_effort="low"', "exec", "inspect"];
  const explicitEffort = run(["--sift-lane=forge", ...effortOverride]);
  assert.equal(explicitEffort.status, 0);
  assert.deepEqual(JSON.parse(explicitEffort.stdout), ["-c", `model="${model}"`, ...effortOverride]);

  for (const modelOverride of [["--model", "manual"], ["-m=manual"], ["-c", 'model="manual"']]) {
    const args = [...modelOverride, "exec", "--", "--sift-off"];
    const explicit = run(["--sift-lane=forge", ...args]);
    assert.equal(explicit.status, 0);
    assert.deepEqual(JSON.parse(explicit.stdout), args);
  }

  const bypass = run(["--sift-off", "--sift-lane=forge", "exec", "inspect"]);
  assert.equal(bypass.status, 0);
  assert.deepEqual(JSON.parse(bypass.stdout), ["exec", "inspect"]);
});

test("launch still starts its provider when Sift storage is unavailable", () => {
  const { root, run } = fixture();
  const unavailable = join(root, "not-a-directory");
  writeFileSync(unavailable, "");
  const child = run(["--model=sift", "exec", "inspect"], { SIFT_HOME: unavailable });
  assert.equal(child.status, 0);
  const args: string[] = JSON.parse(child.stdout);
  assert.ok(args.includes('model_provider="sift"'));
  assert.ok(args.some((arg) => arg.startsWith('model_providers.sift.base_url="http://127.0.0.1:')));
});
