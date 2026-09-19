import { redact } from "./redact.js";
import { applyPolicy, fallbackSignals } from "./policy.js";
import type { Decision, Policy, Signals } from "./types.js";

const QUESTIONS = {
  task_kind: {
    type: "choice",
    instructions: "What kind of coding-agent turn is this user request?",
    criteria: {
      ask: "Explain, search, or answer without editing code",
      edit: "Localized code change in known files",
      debug: "Find and fix a failure with evidence",
      refactor: "Restructure existing code with similar behavior",
      architecture: "Cross-cutting design or a new subsystem",
      review: "Read-only review of a diff or change",
      ops: "Git, install, CI, or environment plumbing",
    },
  },
  difficulty: {
    type: "score",
    instructions: "How hard is this for a coding agent?",
    criteria: [
      "Trivial: rename, one-liner, or lookup",
      "Localized: one file or a small known pattern",
      "Multi-file: several modules, some ambiguity",
      "Hard or novel: unclear cause, deep reasoning, high blast radius",
    ],
  },
  needs_reasoning: {
    type: "noul",
    instructions: "Requires multi-step diagnosis or non-obvious design",
  },
  needs_planning: {
    type: "noul",
    instructions: "Should plan before editing",
  },
  high_stakes: {
    type: "noul",
    instructions: "Touches auth, payments, production, migrations, or secrets",
  },
  cross_cutting: {
    type: "noul",
    instructions: "Will span many files or shared contracts",
  },
};

export class JevUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevUnavailable";
  }
}

type JevAnswer = {
  type?: string;
  choice?: string;
  score?: number;
  noul?: number;
  confidence?: number;
};

type JevResponse = {
  model?: string;
  answers?: Record<string, JevAnswer>;
};

function typesafeBase(): string {
  return (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/$/, "");
}

function readNoul(answer: JevAnswer | undefined): number {
  if (!answer) return 0;
  if (typeof answer.noul === "number") return answer.noul;
  return 0;
}

export function answersToSignals(answers: Record<string, JevAnswer>, hasImage: boolean): Signals {
  const kind = answers.task_kind || {};
  const difficulty = answers.difficulty || {};
  const kindConf = typeof kind.confidence === "number" ? kind.confidence : 1;
  const diffConf = typeof difficulty.confidence === "number" ? difficulty.confidence : 1;
  return {
    task_kind: kind.choice || "edit",
    task_kind_confidence: kindConf,
    difficulty: typeof difficulty.score === "number" ? difficulty.score : 1,
    difficulty_confidence: diffConf,
    needs_reasoning: readNoul(answers.needs_reasoning),
    needs_planning: readNoul(answers.needs_planning),
    high_stakes: readNoul(answers.high_stakes),
    cross_cutting: readNoul(answers.cross_cutting),
    confidence: Math.min(kindConf, diffConf),
    has_image: hasImage,
  };
}

export async function callJev(state: unknown, policy: Policy): Promise<JevResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new JevUnavailable("TYPESAFE_API_KEY is not set");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.jev_timeout_ms);
  try {
    const res = await fetch(`${typesafeBase()}/v1/systemone`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: policy.jev_model,
        state,
        questions: QUESTIONS,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new JevUnavailable(`Jev HTTP ${res.status} ${text.slice(0, 180)}`);
    }
    return (await res.json()) as JevResponse;
  } catch (err) {
    if (err instanceof JevUnavailable) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new JevUnavailable(message);
  } finally {
    clearTimeout(timer);
  }
}

export async function decideTurn(
  policy: Policy,
  prompt: string,
  extras: { hasImage?: boolean; retry?: boolean; previousLane?: string } = {},
): Promise<Decision> {
  const redacted = redact(prompt);
  const hasImage = extras.hasImage ?? false;
  const started = Date.now();
  try {
    const response = await callJev(
      {
        task: redacted,
        has_image: hasImage,
        retry: Boolean(extras.retry),
        previous_lane: extras.previousLane ?? null,
      },
      policy,
    );
    const signals = answersToSignals(response.answers || {}, hasImage);
    return applyPolicy(policy, signals, {
      jev_ms: Date.now() - started,
      prompt_chars: redacted.length,
    });
  } catch {
    const signals = fallbackSignals(redacted, hasImage);
    const decision = applyPolicy(policy, signals, {
      jev_ms: Date.now() - started,
      prompt_chars: redacted.length,
      degraded: true,
    });
    const fallback = policy.lanes[policy.on_jev_down];
    if (fallback) {
      decision.lane = policy.on_jev_down;
      decision.model = fallback.model;
      decision.effort = fallback.effort;
    }
    decision.reason = ["Jev unavailable, using fallback lane", ...decision.reason];
    decision.degraded = true;
    return decision;
  }
}
