import type { Policy } from "./types.js";

export type Effectiveness = {
  score: number;
  tokenScore: number;
  jevAvailable: boolean;
  estimatedInputTokens: number;
  contextWindowTokens: number;
  occupancy: number;
  needsMoreContext: number;
};

export function estimateInputTokens(body: Record<string, unknown>): number {
  // Approximation only: bytes/4 is not the model tokenizer's input count.
  return Math.ceil(Buffer.byteLength(JSON.stringify(body), "utf8") / 4);
}

export function assessEffectiveness(
  body: Record<string, unknown>,
  policy: Policy,
  needsMoreContext: number | null,
  contextWindowTokens = policy.effectiveness.context_window_tokens || 272000,
): Effectiveness {
  return assessEffectivenessTokens(estimateInputTokens(body), policy, needsMoreContext, contextWindowTokens);
}

export function assessEffectivenessTokens(
  estimatedInputTokens: number,
  policy: Policy,
  needsMoreContext: number | null,
  contextWindowTokens = policy.effectiveness.context_window_tokens || 272000,
): Effectiveness {
  const occupancy = contextWindowTokens > 0 ? estimatedInputTokens / contextWindowTokens : 0;
  const jevAvailable = needsMoreContext !== null;
  const growth = Math.min(1, Math.max(0, needsMoreContext ?? 0));
  const fullScoreUntil = policy.effectiveness.full_score_until_percent / 100;
  const maxPressureAt = policy.effectiveness.max_pressure_at_percent / 100;
  const pressure = Math.min(1, Math.max(0, (occupancy - fullScoreUntil) / (maxPressureAt - fullScoreUntil)));
  const tokenScore = Math.round(100 * (1 - pressure));
  const score = Math.round(tokenScore * (1 - 0.35 * growth * pressure));
  return {
    score,
    tokenScore,
    jevAvailable,
    estimatedInputTokens,
    contextWindowTokens,
    occupancy,
    needsMoreContext: growth,
  };
}
