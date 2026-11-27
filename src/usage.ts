import type { Lane, Policy } from "./types.js";

type Weights = Pick<Policy, "usage_weight" | "effort_weight">;
export type WeightSnapshot = Weights & { forge: Lane };
export type Baseline = Partial<Lane>;

export type UsageRow = {
  lane: string;
  model: string;
  effort?: string;
  degraded?: boolean;
  weights?: WeightSnapshot;
  estimate?: boolean;
};

export type UsageSummary = {
  turns: number;
  liveTurns: number;
  estimatedTurns: number;
  degraded: number;
  mix: Record<string, number>;
  alwaysForge: number;
  actual: number;
  saved: number;
  savedPct: number;
  forgeModel: string;
  baselineModel: string;
  baselineEffort: string;
  baselineUnits: number;
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

function weight(configured: Record<string, number>, defaults: Record<string, number>, key: string): number {
  return Object.hasOwn(configured, key) && Number.isFinite(configured[key])
    ? configured[key]
    : Object.hasOwn(defaults, key) ? defaults[key] : 1;
}

export function turnCost(weights: Weights, model: string, effort?: string): number {
  const modelW = weight(weights.usage_weight, DEFAULT_USAGE, model);
  const effortW = weight(weights.effort_weight, DEFAULT_EFFORT, effort || "medium");
  return modelW * effortW;
}

export function snapshotWeights(policy: Policy): WeightSnapshot {
  return {
    usage_weight: { ...DEFAULT_USAGE, ...policy.usage_weight },
    effort_weight: { ...DEFAULT_EFFORT, ...policy.effort_weight },
    forge: { ...(policy.lanes.forge ?? { model: "gpt-5.6-sol", effort: "high" }) },
  };
}

export function summarizeUsage(policy: Policy, rows: UsageRow[], baseline: Baseline = {}): UsageSummary {
  const current = snapshotWeights(policy);
  const mix = Object.create(null) as Record<string, number>;
  const baselineModels = new Set<string>();
  const baselineEfforts = new Set<string>();
  let actual = 0;
  let baselineUnits = 0;
  let liveTurns = 0;
  let estimatedTurns = 0;
  let degraded = 0;
  for (const row of rows) {
    mix[row.lane] = (mix[row.lane] || 0) + 1;
    if (row.degraded) {
      degraded += 1;
      continue;
    }
    liveTurns += 1;
    if (row.estimate === false) continue;
    const weights = row.weights ?? current;
    const model = baseline.model ?? weights.forge.model;
    const effort = baseline.effort ?? (baseline.model ? "medium" : weights.forge.effort ?? "medium");
    baselineModels.add(model);
    baselineEfforts.add(effort);
    estimatedTurns += 1;
    actual += turnCost(weights, row.model, row.effort);
    baselineUnits += turnCost(weights, model, effort);
  }
  const baselineModel = baselineModels.size > 1 ? "historical forge models"
    : baselineModels.values().next().value ?? baseline.model ?? current.forge.model;
  const baselineEffort = baselineEfforts.size > 1 ? "varied"
    : baselineEfforts.values().next().value ?? baseline.effort ?? (baseline.model ? "medium" : current.forge.effort ?? "medium");
  const saved = baselineUnits - actual;
  const savedPct = baselineUnits > 0 ? (saved / baselineUnits) * 100 : 0;
  return {
    turns: rows.length,
    liveTurns,
    estimatedTurns,
    degraded,
    mix,
    alwaysForge: baselineUnits,
    actual,
    saved,
    savedPct,
    forgeModel: current.forge.model,
    baselineModel,
    baselineEffort,
    baselineUnits,
  };
}

export function formatUsage(summary: UsageSummary): string {
  const mix = Object.entries(summary.mix)
    .sort((a, b) => b[1] - a[1])
    .map(([lane, n]) => `${lane} ${n} (${((n / Math.max(1, summary.turns)) * 100).toFixed(0)}%)`)
    .join("  ");
  const lines = [
    `turns: ${summary.turns}  (live decisions: ${summary.liveTurns}, degraded: ${summary.degraded})`,
    `mix: ${mix || "(none)"}`,
  ];
  if (summary.estimatedTurns) {
    const delta = summary.saved > 0 ? "+" : "";
    lines.push(
      `estimated units vs ${summary.baselineModel} (${summary.baselineEffort}): ${summary.baselineUnits.toFixed(2)} -> ${summary.actual.toFixed(2)}`,
      `estimated savings: ${delta}${summary.saved.toFixed(2)} units (${delta}${summary.savedPct.toFixed(1)}%) across ${summary.estimatedTurns} turns`,
      "Estimates use policy model and effort weights. Measured tokens, when available, are shown separately.",
    );
  } else {
    lines.push("Estimated savings unavailable for this selection.");
  }
  return lines.join("\n");
}
