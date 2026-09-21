import { loadPolicy } from "./policy.js";
import { readLog, type DecisionRecord } from "./log.js";
import { formatUsage, summarizeUsage } from "./usage.js";

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

export function runReport(argv: string[] = []): number {
  const jsonMode = argv.includes("--json");
  const liveOnly = argv.includes("--live");
  const since = parseSince(argv);
  const policy = loadPolicy();
  let rows: DecisionRecord[] = readLog();
  if (since) rows = rows.filter((row) => new Date(row.at) >= since);
  if (liveOnly) rows = rows.filter((row) => !row.degraded);
  if (!rows.length) {
    process.stdout.write("No decisions logged yet. Use Codex through `codex-sift`, then rerun report.\n");
    return 1;
  }
  const summary = summarizeUsage(policy, rows);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify({ summary, turns: rows.length }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`${formatUsage(summary)}\n`);
  return 0;
}
