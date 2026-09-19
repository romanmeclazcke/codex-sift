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
  virtual_model: {
    slug: string;
    display_name: string;
    description: string;
  };
  lanes: Record<LaneName, Lane>;
  prices_usd_per_1m: Record<string, number>;
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
};

export type SessionPin = {
  conversationKey: string;
  lastUserText: string;
  decision: Decision;
};
