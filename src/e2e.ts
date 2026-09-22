import { decideTurn } from "./jev.js";
import { loadPolicy } from "./policy.js";
import { formatUsage, summarizeUsage, turnCost } from "./usage.js";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Decision, Policy } from "./types.js";

export type E2ECase = {
  id: string;
  category: string;
  expectedLane: string;
  prompt: string;
};

export type E2ERow = E2ECase & {
  actualLane: string;
  model: string;
  effort?: string;
  degraded: boolean;
  jevMs: number;
  promptChars: number;
  expectedMatch: boolean;
  baselineUsage: number;
  actualUsage: number;
  savedPct: number;
  reason: string;
};

export const PROGRAMMING_CASES: E2ECase[] = [
  {
    id: "ask-basic",
    category: "Ask",
    expectedLane: "flash",
    prompt: "what does package.json do in a Node project?",
  },
  {
    id: "repo-command",
    category: "Ops",
    expectedLane: "flash",
    prompt: "how do I run the unit tests in this repo?",
  },
  {
    id: "small-rename",
    category: "Localized edit",
    expectedLane: "flash",
    prompt: "rename getUser to fetchUser in src/api.ts",
  },
  {
    id: "small-ui",
    category: "Localized edit",
    expectedLane: "craft",
    prompt: "add a loading spinner to the submit button in LoginForm.tsx",
  },
  {
    id: "react-explain",
    category: "Ask",
    expectedLane: "flash",
    prompt: "explain what useMemo is for in this React component",
  },
  {
    id: "hook-extract",
    category: "Implementation",
    expectedLane: "craft",
    prompt: "extract the fetch in page.tsx into a reusable hook",
  },
  {
    id: "timezone-test",
    category: "Debug",
    expectedLane: "craft",
    prompt: "the test formatDate.test.ts is failing on timezone, fix the assertion",
  },
  {
    id: "typescript-error",
    category: "Debug",
    expectedLane: "craft",
    prompt: "this TypeScript error: Type X is not assignable to type Y on the props",
  },
  {
    id: "suite-leak",
    category: "Debug",
    expectedLane: "forge",
    prompt: "the auth test fails only when run with the full suite, find the leak",
  },
  {
    id: "auth-redesign",
    category: "Architecture",
    expectedLane: "forge",
    prompt: "redesign authentication across the Next.js app and the API gateway",
  },
  {
    id: "websocket-race",
    category: "Hard debug",
    expectedLane: "forge",
    prompt: "debug a race in websocket reconnect that duplicates subscriptions",
  },
  {
    id: "prod-migration",
    category: "High stakes",
    expectedLane: "forge",
    prompt: "ship a production database migration that changes user permissions and preserves existing sessions",
  },
];

function percent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function parseOutputFlag(argv: string[], name: string): string | null {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1] || null;
  return null;
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function rowFromDecision(policy: Policy, testCase: E2ECase, decision: Decision): E2ERow {
  const forge = turnCost(policy, policy.lanes.forge.model, policy.lanes.forge.effort);
  const actual = turnCost(policy, decision.model, decision.effort);
  return {
    ...testCase,
    actualLane: decision.lane,
    model: decision.model,
    effort: decision.effort,
    degraded: decision.degraded,
    jevMs: decision.jev_ms,
    promptChars: decision.prompt_chars,
    expectedMatch: decision.lane === testCase.expectedLane,
    baselineUsage: forge,
    actualUsage: actual,
    savedPct: forge > 0 ? ((forge - actual) / forge) * 100 : 0,
    reason: decision.reason.join("; "),
  };
}

export function formatMarkdownReport(policy: Policy, rows: E2ERow[], generatedAt = new Date()): string {
  const summary = summarizeUsage(policy, rows.map((row) => ({
    lane: row.actualLane,
    model: row.model,
    effort: row.effort,
    degraded: row.degraded,
  })));
  const matches = rows.filter((row) => row.expectedMatch).length;
  const passRate = rows.length ? (matches / rows.length) * 100 : 0;
  const liveRows = rows.filter((row) => !row.degraded);
  const avgJevMs = liveRows.length ? liveRows.reduce((acc, row) => acc + row.jevMs, 0) / liveRows.length : 0;
  const degradedNote = summary.degraded
    ? `\n\n> ${summary.degraded} degraded cases used the fallback lane and should not be used as savings proof.`
    : "";
  const table = rows
    .map((row) => `| ${[
      row.id,
      row.category,
      row.expectedLane,
      row.actualLane,
      row.model,
      row.effort || "",
      row.expectedMatch ? "yes" : "no",
      row.degraded ? "yes" : "no",
      row.jevMs,
      row.actualUsage.toFixed(2),
      percent(row.savedPct),
      row.prompt.replace(/\|/g, "\\|"),
    ].join(" | ")} |`)
    .join("\n");

  return `# Codex Sift E2E Routing Report

Generated: ${generatedAt.toISOString()}

## Summary

- Cases: ${rows.length}
- Live Jev cases: ${summary.liveTurns}
- Degraded cases: ${summary.degraded}
- Policy expectation match: ${matches}/${rows.length} (${percent(passRate)})
- Average Jev latency: ${avgJevMs.toFixed(0)} ms
- Baseline: every live turn on ${summary.forgeModel}
- Usage: ${summary.alwaysForge.toFixed(2)} -> ${summary.actual.toFixed(2)}
- Estimated quota saved: ${percent(summary.savedPct)}

${degradedNote}

## Lane Mix

${Object.entries(summary.mix)
  .sort((a, b) => b[1] - a[1])
  .map(([lane, count]) => `- ${lane}: ${count}`)
  .join("\n")}

## Case Results

| ID | Category | Policy expected | Actual | Model | Effort | Policy match | Degraded | Jev ms | Usage | Saved vs forge | Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
${table}

## Interpretation

Sift is compared against an always-forge baseline. This report measures routing and quota efficiency, not answer quality. The policy expectation column validates whether each representative prompt landed on the lane this repository expects. A case is counted as savings evidence only when Jev answered live; degraded fallback cases are listed for reliability tracking but excluded from the savings calculation.
`;
}

export function formatConsoleReport(policy: Policy, rows: E2ERow[]): string {
  const lines = ["E2E programming session (Jev only — Codex quota is not used)", ""];
  for (const row of rows) {
    const status = row.expectedMatch ? "match" : "check";
    const tag = row.degraded ? " degraded" : "";
    lines.push(
      `${row.actualLane.padEnd(6)} ${row.model.padEnd(14)} ${String(row.effort || "-").padEnd(7)} ${percent(row.savedPct).padEnd(10)} ${status.padEnd(5)} ${row.id}${tag}`,
    );
  }
  lines.push("", formatUsage(summarizeUsage(policy, rows.map((row) => ({
    lane: row.actualLane,
    model: row.model,
    effort: row.effort,
    degraded: row.degraded,
  })))));
  return lines.join("\n");
}

export async function runE2E(argv: string[] = []): Promise<number> {
  const policy = loadPolicy();
  if (!process.env.TYPESAFE_API_KEY) {
    process.stderr.write("codex-sift e2e needs TYPESAFE_API_KEY. Export it in this terminal and retry.\n");
    return 1;
  }
  const rows: E2ERow[] = [];
  for (const testCase of PROGRAMMING_CASES) {
    const decision = await decideTurn(policy, testCase.prompt);
    rows.push(rowFromDecision(policy, testCase, decision));
  }
  process.stdout.write(`${formatConsoleReport(policy, rows)}\n`);

  const jsonOut = parseOutputFlag(argv, "--json-out");
  if (jsonOut) {
    ensureParent(jsonOut);
    const summary = summarizeUsage(policy, rows.map((row) => ({
      lane: row.actualLane,
      model: row.model,
      effort: row.effort,
      degraded: row.degraded,
    })));
    writeFileSync(jsonOut, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2)}\n`);
    process.stdout.write(`wrote ${jsonOut}\n`);
  }

  const markdownOut = parseOutputFlag(argv, "--out");
  if (markdownOut) {
    ensureParent(markdownOut);
    writeFileSync(markdownOut, formatMarkdownReport(policy, rows));
    process.stdout.write(`wrote ${markdownOut}\n`);
  }

  return rows.some((row) => row.degraded) ? 1 : 0;
}
