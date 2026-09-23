export const VIRTUAL_SLUG_DEFAULT = "sift";
export const PROVIDER_ID = "sift";

export type LaneName = string;

export type Lane = {
  model: string;
  effort?: string;
};

export type PolicyRule = {
  when: string;
  lane: LaneName;
  reason: string;
};

export type Policy = {
  jev_model: string;
  jev_timeout_ms: number;
  min_confidence: number;
  on_jev_down: LaneName;
  effectiveness: {
    context_window_tokens: number;
    full_score_until_percent: number;
    max_pressure_at_percent: number;
  };
  virtual_model: {
    slug: string;
    display_name: string;
    description: string;
  };
  lanes: Record<LaneName, Lane>;
  prices_usd_per_1m: Record<string, number>;
  usage_weight: Record<string, number>;
  effort_weight: Record<string, number>;
  rules: PolicyRule[];
};

export type Signals = {
  task_kind: string;
  task_kind_confidence: number;
  difficulty: number;
  difficulty_confidence: number;
  needs_reasoning: number;
  needs_planning: number;
  high_stakes: number;
  cross_cutting: number;
  is_chitchat: number;
  confidence: number;
  has_image: boolean;
};

export type Decision = {
  lane: LaneName;
  model: string;
  effort?: string;
  reason: string[];
  signals: Signals;
  degraded: boolean;
  jev_ms: number;
  prompt_chars: number;
  effectiveness?: {
    score: number;
    tokenScore: number;
    jevAvailable: boolean;
    estimatedInputTokens: number;
    contextWindowTokens: number;
    occupancy: number;
    needsMoreContext: number;
  };
};

export type SessionPin = {
  conversationKey: string;
  lastUserText: string;
  decision: Decision;
};
