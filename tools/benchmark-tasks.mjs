import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadLocalEnv } from "../dist/env.js";
import { bundledPolicyPath, loadPolicyFile } from "../dist/policy.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtures = join(root, "benchmarks", "task-completion");
const manifest = join(fixtures, "tasks.json");
const tasks = JSON.parse(readFileSync(manifest, "utf8"));
const policyPath = bundledPolicyPath();
const policy = loadPolicyFile(policyPath);
const baseline = policy.lanes.forge;
const usageFields = ["input_tokens", "cached_input_tokens", "cache_write_input_tokens", "output_tokens", "reasoning_output_tokens"];
const attemptLimit = 2;
const graderTimeoutMs = 15_000;

const { values } = parseArgs({
  options: {
    smoke: { type: "boolean" },
    live: { type: "boolean" },
    trials: { type: "string", default: "3" },
    "timeout-seconds": { type: "string", default: "300" },
    out: { type: "string" },
  },
});

const mode = values.smoke ? "smoke" : "live";
const trialCount = Number(values.trials);
const timeoutMs = 1000 * Number(values["timeout-seconds"]);
assert.notEqual(Boolean(values.smoke), Boolean(values.live), "Select exactly one of --smoke or --live");
assert(Number.isSafeInteger(trialCount) && trialCount >= 2, "Use at least two --trials per task and strategy");
assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2_147_483_647, "Invalid --timeout-seconds");
assert(!(values.smoke && values.out && resolve(values.out) === join(root, "reports", "task-completion.json")),
  "Write smoke results to stdout or a separate path");
const out = values.out ? resolve(values.out) : null;

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const millis = (since) => Math.round(performance.now() - since);
const graderEnv = { PATH: process.env.PATH, LANG: "C", NO_COLOR: "1" };
const sourceRevision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() || null;
const worktreeDigest = spawnSync("git", ["diff", "HEAD", "--", "src"], { cwd: root, encoding: "buffer" });
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), ".codex"));
const codex = process.env.CODEX_BIN || "codex";

function exec(command, args, { cwd, env, timeout }) {
  const started = performance.now();
  return new Promise((complete) => {
    const useProcessGroup = process.platform !== "win32";
    const child = spawn(command, args, { cwd, env, detached: useProcessGroup, stdio: ["ignore", "pipe", "ignore"] });
    const stdout = [];
    let bytes = 0;
    let error = null;

    function stop(reason) {
      error = reason;
      if (!child.pid) return;
      try {
        if (useProcessGroup) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (killError) {
        if (killError.code !== "ESRCH") throw killError;
      }
    }

    const timer = setTimeout(() => stop("timeout"), timeout);
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes <= 16 * 1024 * 1024) stdout.push(chunk);
      else if (!error) stop("output_limit");
    });
    child.once("error", (failure) => { error ??= failure.code || "spawn_error"; });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      complete({ code, signal, error, stdout: Buffer.concat(stdout).toString("utf8"), elapsed_ms: millis(started) });
    });
  });
}

async function preflight() {
  const git = await exec("git", ["--version"], { cwd: root, timeout: 10_000 });
  assert.equal(git.code, 0, "Git is required to create fresh fixture repositories");
  if (mode === "smoke") return null;

  loadLocalEnv();
  assert(process.env.TYPESAFE_API_KEY, "Set TYPESAFE_API_KEY or configure it with codex-sift setup before a live run");
  const version = await exec(codex, ["--version"], { cwd: root, timeout: 10_000 });
  assert.equal(version.code, 0, "A working Codex CLI is required for a live run");
  const auth = await exec(codex, ["login", "status"], { cwd: root, timeout: 10_000 });
  assert.equal(auth.code, 0, "Sign into Codex before a live run");
  return version.stdout.trim();
}

function createCheckout(task, cwd) {
  cpSync(join(fixtures, task.id), cwd, { recursive: true });
  const gitEnv = {
    ...graderEnv,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
  };
  for (const args of [
    ["init", "--quiet", "--object-format=sha1"],
    ["add", "."],
    ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "--message=Benchmark base"],
  ]) {
    const git = spawnSync("git", args, { cwd, env: gitEnv, stdio: "ignore" });
    assert.equal(git.status, 0, `Cannot initialize fixture repository ${task.id}`);
  }
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd, env: gitEnv, encoding: "utf8" });
  assert.equal(revision.status, 0, `Cannot identify base commit for ${task.id}`);
  return revision.stdout.trim();
}

async function grade(task, checkout, staging, checkAcceptance = true) {
  const started = performance.now();
  const dir = realpathSync(mkdtempSync(join(staging, "grade-")));
  try {
    for (const file of task.files) {
      const source = join(checkout, file);
      if (!existsSync(source) || !lstatSync(source).isFile()) {
        return { passed: false, status: "missing_source", elapsed_ms: millis(started) };
      }
      copyFileSync(source, join(dir, file));
    }
    copyFileSync(join(fixtures, task.id, "public.test.mjs"), join(dir, "public.test.mjs"));
    if (checkAcceptance) {
      copyFileSync(join(fixtures, "acceptance", `${task.id}.test.mjs`), join(dir, "acceptance.test.mjs"));
    }
    writeFileSync(join(dir, "grade.mjs"), [
      'import "./public.test.mjs";',
      ...(checkAcceptance ? ['import "./acceptance.test.mjs";'] : []),
    ].join("\n"));
    const permission = process.allowedNodeEnvironmentFlags.has("--permission") ? "--permission" : "--experimental-permission";
    const result = await exec(process.execPath, [permission, `--allow-fs-read=${dir}`, "--test-reporter=tap", "grade.mjs"], {
      cwd: dir, env: graderEnv, timeout: graderTimeoutMs,
    });
    const tests = Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]);
    const passedTests = Number(result.stdout.match(/^# pass (\d+)$/m)?.[1]);
    const completedSuite = tests >= (checkAcceptance ? 2 : 1) && passedTests === tests;
    const passed = !result.error && result.code === 0 && completedSuite;
    return {
      passed,
      status: result.error || (passed ? "passed" : "tests_failed"),
      elapsed_ms: millis(started),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readEvents(stdout) {
  return stdout.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function countUsage(turns) {
  return Object.fromEntries(usageFields.map((field) => {
    const values = turns.map((turn) => turn.usage?.[field]);
    const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
    return [field, valid.length && valid.length === turns.length
      ? valid.reduce((sum, value) => sum + value, 0)
      : null];
  }));
}

function readDecisions(siftHome) {
  const file = join(siftHome, "decisions.jsonl");
  if (!existsSync(file)) return [];
  return readEvents(readFileSync(file, "utf8")).map((decision) => ({
    lane: decision.lane,
    model: decision.model,
    effort: decision.effort ?? null,
    degraded: decision.degraded,
    jev_ms: decision.jev_ms,
  }));
}

async function attempt(task, strategy, trial, number, cwd, temp) {
  const attemptHome = join(temp, `attempt-${number}`);
  const siftHome = join(attemptHome, "sift");
  mkdirSync(attemptHome);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("SIFT_") && key !== "CODEX_SIFT_ACTIVE"));
  Object.assign(env, {
    HOME: attemptHome,
    CODEX_HOME: codexHome,
    CODEX_BIN: codex,
    SIFT_HOME: siftHome,
    SIFT_POLICY: policyPath,
    SIFT_QUIET: "1",
  });

  const instructions = "Edit the repository files as needed. Run `node --test public.test.mjs`. Leave test files unchanged.";
  const retry = number > 1 ? "\n\nThe previous attempt did not pass verification. Its working tree is still here. Inspect and correct the implementation before finishing." : "";
  const prompt = `${task.prompt}\n\n${instructions}${retry}`;
  const common = ["-a", "never", "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral",
    "--sandbox", "workspace-write", "--json"];
  let result;
  let decisions = [];
  if (mode === "smoke") {
    const outcome = strategy === "fixed" || (trial % 2 === 1 && number === 2)
      ? "pass"
      : number === 1 ? "grader_failure" : "agent_failure";
    result = await exec(process.execPath, [join(fixtures, "smoke", "codex.mjs"), task.id, outcome], {
      cwd, env: graderEnv, timeout: timeoutMs,
    });
    if (strategy === "sift" && outcome !== "agent_failure") decisions = [{
      lane: trial % 2 === 1 ? "flash" : "craft",
      model: "smoke",
      effort: null,
      degraded: trial % 2 === 0,
      jev_ms: null,
    }];
  } else if (strategy === "fixed") {
    const effort = baseline.effort ? ["-c", `model_reasoning_effort=${JSON.stringify(baseline.effort)}`] : [];
    result = await exec(codex, [...common, "--model", baseline.model, ...effort, prompt], { cwd, env, timeout: timeoutMs });
  } else {
    result = await exec(process.execPath, [join(root, "dist", "cli.js"), ...common, prompt], { cwd, env, timeout: timeoutMs });
    decisions = readDecisions(siftHome);
  }

  const events = readEvents(result.stdout);
  const turns = events.filter((event) => event.type === "turn.completed");
  const grading = await grade(task, cwd, temp);
  const agentStatus = result.error ?? (result.code === 0 && turns.length > 0 && !events.some((event) => event.type === "turn.failed")
    ? "completed" : "failed");
  return {
    number,
    agent_status: agentStatus,
    exit_code: result.code,
    signal: result.signal,
    agent_ms: result.elapsed_ms,
    grader: grading,
    passed: agentStatus === "completed" && grading.passed && (strategy === "fixed" || decisions.length > 0),
    usage: countUsage(turns),
    routing: decisions,
  };
}

async function runTrial(task, strategy, trial, temp) {
  const working = mkdtempSync(join(temp, "run-"));
  try {
    const checkout = join(working, "checkout");
    const base_commit = createCheckout(task, checkout);
    const started = performance.now();
    const attempts = [];
    for (let number = 1; number <= attemptLimit; number++) {
      const result = await attempt(task, strategy, trial, number, checkout, working);
      attempts.push(result);
      if (result.passed) break;
    }
    const completed = attempts.at(-1).passed;
    const elapsed = millis(started);
    return {
      task: task.id,
      strategy,
      trial,
      base_commit,
      first_try: attempts[0].passed,
      completed,
      total_ms: elapsed,
      time_to_completion_ms: completed ? elapsed : null,
      attempts,
    };
  } finally {
    rmSync(working, { recursive: true, force: true });
  }
}

function summarize(rows, strategy) {
  const trials = rows.filter((row) => row.strategy === strategy);
  const attempts = trials.flatMap((row) => row.attempts);
  const completed = trials.filter((row) => row.completed);
  const decisions = attempts.flatMap((attempt) => attempt.routing);
  const sum = (items, get) => items.reduce((total, item) => total + get(item), 0);
  return {
    trials: trials.length,
    first_try: trials.filter((row) => row.first_try).length,
    completed: completed.length,
    attempts: attempts.length,
    agent_failures: attempts.filter((attempt) => attempt.agent_status !== "completed").length,
    total_ms: sum(trials, (row) => row.total_ms),
    mean_time_to_completion_ms: completed.length
      ? Math.round(sum(completed, (row) => row.time_to_completion_ms) / completed.length)
      : null,
    usage: Object.fromEntries(usageFields.map((field) => {
      const reported = attempts.filter((attempt) => attempt.usage[field] !== null);
      return [field, { total: reported.length ? sum(reported, (attempt) => attempt.usage[field]) : null,
        attempts_reported: reported.length }];
    })),
    routing: strategy === "sift" ? {
      live: decisions.filter((decision) => !decision.degraded).length,
      degraded: decisions.filter((decision) => decision.degraded).length,
      attempts_without_decision: attempts.filter((attempt) => attempt.routing.length === 0).length,
    } : null,
  };
}

function fixtureDigest(task) {
  return hash(JSON.stringify({
    task,
    source: [...task.files, "public.test.mjs"].map((file) => hash(readFileSync(join(fixtures, task.id, file)))),
    acceptance: hash(readFileSync(join(fixtures, "acceptance", `${task.id}.test.mjs`))),
  }));
}

function writeReport(report) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (!out) {
    process.stdout.write(json);
    return;
  }
  const staging = mkdtempSync(join(dirname(out), ".task-benchmark-"));
  try {
    const candidate = join(staging, "report.json");
    writeFileSync(candidate, json, { flag: "wx" });
    renameSync(candidate, out);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

const version = await preflight();
const temp = mkdtempSync(join(tmpdir(), "sift-task-benchmark-"));
try {
  for (const task of tasks) {
    const fixture = join(fixtures, task.id);
    assert((await grade(task, fixture, temp, false)).passed, `Broken public tests for base fixture ${task.id}`);
    assert.equal((await grade(task, fixture, temp)).status, "tests_failed", `Acceptance checks must reject base fixture ${task.id}`);
  }

  const rows = [];
  for (const [index, task] of tasks.entries()) {
    for (let trial = 1; trial <= trialCount; trial++) {
      const strategies = (index + trial) % 2 ? ["fixed", "sift"] : ["sift", "fixed"];
      for (const strategy of strategies) {
        const row = await runTrial(task, strategy, trial, temp);
        rows.push(row);
        process.stderr.write(`${task.id} trial ${trial} · ${strategy} · ${row.completed ? "passed" : "failed"} in ${row.attempts.length} attempt(s)\n`);
      }
    }
  }
  const baseCommits = Object.fromEntries(tasks.map((task) => {
    const commits = new Set(rows.filter((row) => row.task === task.id).map((row) => row.base_commit));
    assert.equal(commits.size, 1, `Inconsistent base commits for ${task.id}`);
    return [task.id, commits.values().next().value];
  }));
  const summary = { fixed: summarize(rows, "fixed"), sift: summarize(rows, "sift") };
  if (mode === "smoke") {
    assert.equal(summary.fixed.first_try, tasks.length * trialCount);
    assert.equal(summary.sift.first_try, 0);
    assert.equal(summary.sift.completed, tasks.length * Math.ceil(trialCount / 2));
    assert.equal(summary.sift.agent_failures, tasks.length * Math.floor(trialCount / 2));
    assert.equal(summary.sift.routing.degraded, summary.sift.agent_failures);
    assert.equal(summary.sift.routing.attempts_without_decision, summary.sift.agent_failures);
    assert.equal(summary.sift.usage.input_tokens.attempts_reported, summary.sift.attempts - summary.sift.agent_failures);
    assert.equal(summary.sift.usage.reasoning_output_tokens.total, null);
  }

  writeReport({
    schema_version: 1,
    status: mode === "live" ? "measured" : "offline_smoke",
    generated_at: new Date().toISOString(),
    setup: {
      source_revision: sourceRevision,
      tracked_source_diff_sha256: worktreeDigest.stdout?.length ? hash(worktreeDigest.stdout) : null,
      policy_sha256: hash(readFileSync(policyPath)),
      codex_cli: version,
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      fixed: baseline,
      sift: policy.lanes,
      trials_per_task: trialCount,
      max_attempts: attemptLimit,
      attempt_timeout_ms: timeoutMs,
    },
    tasks: tasks.map((task) => ({
      id: task.id, kind: task.kind, base_commit: baseCommits[task.id], fixture_sha256: fixtureDigest(task),
    })),
    summary,
    rows,
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
