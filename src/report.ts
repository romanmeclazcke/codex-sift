import { loadPolicy } from "./policy.js";
import { readLog, readOutcomes, type DecisionRecord, type OutcomeRecord } from "./log.js";
import type { ResponseUsage } from "./upstream.js";
import { formatUsage, summarizeUsage, type Baseline } from "./usage.js";

const TOKEN_FIELDS = ["input_tokens", "output_tokens", "total_tokens", "cached_input_tokens", "reasoning_tokens"] as const;

function parseSince(argv: string[]): Date | null {
  const flag = argv.find((a) => a.startsWith("--since="));
  if (!flag) return null;
  const raw = flag.slice("--since=".length);
  if (raw === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summarizeOutcomes(rows: DecisionRecord[], outcomes: OutcomeRecord[]) {
  const tasks = new Map(rows.filter((row) => row.task_id).map((row) => [row.task_id, row]));
  const sessions = new Set(rows.flatMap((row) => row.session_id ? [row.session_id] : []));
  const last = new Map<string, OutcomeRecord>();
  const byTask = new Map<string, OutcomeRecord[]>();
  const requests = { completed: 0, failed: 0, incomplete: 0, canceled: 0 };
  const tokens: ResponseUsage = {};
  const tokenCoverage: ResponseUsage = {};
  const latencies: number[] = [];
  let continuations = 0;
  let requestsWithUsage = 0;

  for (const outcome of outcomes) {
    if (tasks.get(outcome.task_id)?.session_id !== outcome.session_id) continue;
    last.set(outcome.task_id, outcome);
    const attempts = byTask.get(outcome.task_id) ?? [];
    attempts.push(outcome);
    byTask.set(outcome.task_id, attempts);
    requests[outcome.outcome] += 1;
    if (outcome.request_kind === "continuation") continuations += 1;
    latencies.push(outcome.latency_ms);
    if (!outcome.usage) continue;
    requestsWithUsage += 1;
    for (const field of TOKEN_FIELDS) {
      const value = outcome.usage[field];
      if (value === undefined) continue;
      tokens[field] = (tokens[field] ?? 0) + value;
      tokenCoverage[field] = (tokenCoverage[field] ?? 0) + 1;
    }
  }

  const taskOutcomes = { completed: 0, failed: 0, incomplete: 0, canceled: 0, unobserved: tasks.size - last.size };
  for (const outcome of last.values()) taskOutcomes[outcome.outcome] += 1;
  latencies.sort((a, b) => a - b);
  return {
    last,
    byTask,
    lifecycle: {
      sessions: sessions.size,
      tasks: taskOutcomes,
      legacy_decisions: rows.length - tasks.size,
      requests,
      continuations,
      upstream_latency_ms: {
        mean: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
        p95: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
      },
      measured_usage: { requests: requestsWithUsage, tokens, token_coverage: tokenCoverage },
    },
  };
}

function describeTasks(rows: DecisionRecord[], byTask: Map<string, OutcomeRecord[]>) {
  return rows.map((row) => ({
    task_id: row.task_id,
    at: row.at,
    lane: row.lane,
    model: row.model,
    effort: row.effort,
    degraded: row.degraded,
    requests: (byTask.get(row.task_id ?? "") ?? []).map((request) => ({
      at: request.at,
      kind: request.request_kind,
      outcome: request.outcome,
      status: request.status,
      latency_ms: request.latency_ms,
      usage: request.usage,
    })),
  }));
}

function formatTasks(tasks: ReturnType<typeof describeTasks>): string {
  return tasks.map((task) => {
    const effort = task.effort ? ` (${task.effort})` : "";
    const degraded = task.degraded ? " [degraded]" : "";
    const lines = [`  ${task.task_id} · ${task.at} · ${task.lane} → ${task.model}${effort}${degraded}`];
    if (!task.requests.length) lines.push("    outcome unobserved");
    for (const request of task.requests) {
      const status = request.status === undefined ? "" : `, HTTP ${request.status}`;
      const tokens = TOKEN_FIELDS.flatMap((field) => request.usage?.[field] === undefined ? [] : [`${field} ${request.usage[field]}`]);
      lines.push(`    ${request.kind} ${request.outcome}${status} · ${request.latency_ms} ms${tokens.length ? ` · ${tokens.join(", ")}` : ""}`);
    }
    return lines.join("\n");
  }).join("\n");
}

function formatOutcomes(result: ReturnType<typeof summarizeOutcomes>["lifecycle"]): string {
  const counts = (values: Record<string, number>) => Object.entries(values).map(([key, value]) => `${key} ${value}`).join(", ");
  const lines = [
    `sessions: ${result.sessions}`,
    `tasks (latest observed response): ${counts(result.tasks)}`,
    `requests: ${counts(result.requests)} (${result.continuations} continuations)`,
  ];
  if (result.legacy_decisions) lines.push(`legacy decisions without outcome records: ${result.legacy_decisions}`);
  const latency = result.upstream_latency_ms;
  if (latency.mean !== null) lines.push(`upstream latency: mean ${latency.mean} ms, p95 ${latency.p95} ms`);
  const usage = result.measured_usage;
  if (usage.requests) {
    const tokens = TOKEN_FIELDS.flatMap((field) => usage.tokens[field] === undefined
      ? []
      : [`${field} ${usage.tokens[field]} (${usage.token_coverage[field]} requests)`]);
    lines.push(`measured tokens across ${usage.requests} requests: ${tokens.join(", ")}`);
  } else {
    lines.push("Measured tokens unavailable for this selection.");
  }
  return lines.join("\n");
}

export function runReport(argv: string[] = []): number {
  const jsonMode = argv.includes("--json");
  const liveOnly = argv.includes("--live");
  const since = parseSince(argv);
  const baseline: Baseline = {
    model: argv.find((arg) => arg.startsWith("--baseline="))?.slice("--baseline=".length),
    effort: argv.find((arg) => arg.startsWith("--baseline-effort="))?.slice("--baseline-effort=".length),
  };
  if (baseline.model === "" || baseline.effort === "") {
    process.stderr.write("Provide a value with --baseline=<model> or --baseline-effort=<effort>.\n");
    return 1;
  }
  const policy = loadPolicy();
  let rows: DecisionRecord[] = readLog();
  if (since) rows = rows.filter((row) => new Date(row.at) >= since);
  if (liveOnly) rows = rows.filter((row) => !row.degraded);
  rows = rows.filter((row) => row.source !== "preview");
  const sessionIds = [...new Set(rows.flatMap((row) => row.session_id ? [row.session_id] : []))];
  const selector = argv.find((arg) => arg.startsWith("--session="))?.slice("--session=".length);
  const selectedSession = selector === "latest" ? rows.slice().reverse().find((row) => row.session_id)?.session_id : selector;
  if (selector !== undefined) rows = rows.filter((row) => row.session_id && row.session_id === selectedSession);
  if (!rows.length && !jsonMode) {
    process.stdout.write(selector === undefined
      ? "No decisions logged yet. Use Codex through `codex-sift`, then rerun report.\n"
      : "No matching session decisions. Run `codex-sift report` to see available sessions.\n");
    return 1;
  }
  const { last, lifecycle, byTask } = summarizeOutcomes(rows, readOutcomes());
  const summary = summarizeUsage(policy, rows.map((row) => ({
    ...row,
    estimate: Boolean(row.task_id && row.weights && last.get(row.task_id)?.outcome === "completed"),
  })), baseline);
  const tasks = selector === undefined ? undefined : describeTasks(rows, byTask);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify({
      summary, turns: rows.length, lifecycle, session_ids: sessionIds, selected_session: selectedSession, tasks,
    }, null, 2)}\n`);
    return rows.length ? 0 : 1;
  }
  const sections = [formatUsage(summary), formatOutcomes(lifecycle)];
  if (tasks) sections.push(`session ${selectedSession}\n${formatTasks(tasks)}`);
  else if (sessionIds.length) sections.push(`session IDs: ${sessionIds.join(", ")}`);
  process.stdout.write(`${sections.join("\n")}\n`);
  return 0;
}
