import type { Policy } from "./types.js";

export type UsageRow = {
  lane: string;
  model: string;
  effort?: string;
  degraded?: boolean;
};

export type UsageSummary = {
  turns: number;
  liveTurns: number;
  degraded: number;
  mix: Record<string, number>;
  alwaysForge: number;
  actual: number;
  saved: number;
  savedPct: number;
  forgeModel: string;
};

const DEFAULT_USAGE: Record<string, number> = {
  "gpt-5.6-luna": 0.25,
  "gpt-5.6-terra": 0.55,
  "gpt-5.6-sol": 1,
  "gpt-6-astra": 1.6,
  "gpt-5.5": 1.1,
};

const DEFAULT_EFFORT: Record<string, number> = {
  low: 0.7,
  medium: 1,
  high: 1.35,
  xhigh: 1.7,
};

export function turnCost(policy: Policy, model: string, effort?: string): number {
  const modelW = policy.usage_weight[model] ?? DEFAULT_USAGE[model] ?? 1;
  const effortW = policy.effort_weight[effort || "medium"] ?? DEFAULT_EFFORT[effort || "medium"] ?? 1;
  return modelW * effortW;
}

export function summarizeUsage(policy: Policy, rows: UsageRow[]): UsageSummary {
  const forgeModel = policy.lanes.forge?.model || "gpt-5.6-sol";
  const forgeEffort = policy.lanes.forge?.effort || "high";
  const alwaysUnit = turnCost(policy, forgeModel, forgeEffort);
  const mix: Record<string, number> = {};
  let actual = 0;
  let liveTurns = 0;
  let degraded = 0;
  for (const row of rows) {
    mix[row.lane] = (mix[row.lane] || 0) + 1;
    if (row.degraded) {
      degraded += 1;
      continue;
    }
    liveTurns += 1;
    actual += turnCost(policy, row.model, row.effort);
  }
  const alwaysForge = liveTurns * alwaysUnit;
  const saved = Math.max(0, alwaysForge - actual);
  const savedPct = alwaysForge > 0 ? (saved / alwaysForge) * 100 : 0;
  return {
    turns: rows.length,
    liveTurns,
    degraded,
    mix,
    alwaysForge,
    actual,
    saved,
    savedPct,
    forgeModel,
  };
}

export function formatUsage(summary: UsageSummary): string {
  const mix = Object.entries(summary.mix)
    .sort((a, b) => b[1] - a[1])
    .map(([lane, n]) => `${lane} ${n} (${((n / Math.max(1, summary.turns)) * 100).toFixed(0)}%)`)
    .join("  ");
  return [
    `turns: ${summary.turns}  (Jev live: ${summary.liveTurns}, degraded: ${summary.degraded})`,
    `mix: ${mix || "(none)"}`,
    `usage vs always-${summary.forgeModel}: ${summary.alwaysForge.toFixed(2)} -> ${summary.actual.toFixed(2)}  (${summary.savedPct.toFixed(0)}% less Codex quota)`,
    `baseline is "every live turn on the forge lane". Weights are in policy.yaml (usage_weight × effort_weight).`,
  ].join("\n");
}
