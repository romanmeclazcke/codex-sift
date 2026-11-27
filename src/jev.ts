import { redact } from "./redact.js";
import { applyPolicy, fallbackSignals, laneFromName } from "./policy.js";
import type { Decision, Policy, Signals } from "./types.js";

const QUESTIONS = {
  task_kind: {
    type: "choice",
    instructions: "What kind of coding-agent turn is the current task? Use the previous task to resolve references in a continuation.",
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
    instructions: "How hard is the current task for a coding agent? Resolve references from the previous task and consider whether a retry follows a failed attempt.",
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
  is_chitchat: {
    type: "noul",
    instructions: "This is a greeting, thanks, or small talk with no coding task",
  },
};

export class JevUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevUnavailable";
  }
}

function typesafeBase(): string {
  return (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/$/, "");
}

function answerRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JevUnavailable(`Invalid Jev response for ${name}`);
  }
  return value as Record<string, unknown>;
}

function readAnswer(
  answers: Record<string, unknown>,
  name: keyof typeof QUESTIONS,
): Record<string, unknown> {
  const answer = answerRecord(answers[name], name);
  if (answer.type !== QUESTIONS[name].type) {
    throw new JevUnavailable(`Unexpected Jev answer type for ${name}`);
  }
  return answer;
}

function readRange(value: unknown, max: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    throw new JevUnavailable(`Invalid Jev value for ${name}`);
  }
  return value;
}

export function answersToSignals(value: unknown, hasImage: boolean): Signals {
  const answers = answerRecord(value, "answers");
  const kind = readAnswer(answers, "task_kind");
  const difficulty = readAnswer(answers, "difficulty");
  const choice = kind.choice;
  if (typeof choice !== "string" || !Object.hasOwn(QUESTIONS.task_kind.criteria, choice)) {
    throw new JevUnavailable("Invalid Jev task kind");
  }
  const kindConf = readRange(kind.confidence, 1, "task_kind.confidence");
  const diffConf = readRange(difficulty.confidence, 1, "difficulty.confidence");
  const readNoul = (name: keyof typeof QUESTIONS) => readRange(readAnswer(answers, name).noul, 1, name);
  return {
    task_kind: choice,
    task_kind_confidence: kindConf,
    difficulty: readRange(difficulty.score, QUESTIONS.difficulty.criteria.length - 1, "difficulty.score"),
    difficulty_confidence: diffConf,
    needs_reasoning: readNoul("needs_reasoning"),
    needs_planning: readNoul("needs_planning"),
    high_stakes: readNoul("high_stakes"),
    cross_cutting: readNoul("cross_cutting"),
    is_chitchat: readNoul("is_chitchat"),
    confidence: diffConf === 0 ? kindConf : Math.min(kindConf, diffConf),
    has_image: hasImage,
  };
}

export async function callJev(state: unknown, policy: Policy): Promise<unknown> {
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
      await res.body?.cancel().catch(() => {});
      throw new JevUnavailable(`Jev HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof JevUnavailable) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new JevUnavailable(message);
  } finally {
    clearTimeout(timer);
  }
}

export function fallbackTurn(
  policy: Policy,
  prompt: string,
  hasImage: boolean,
  reason: string,
  jevMs = 0,
): Decision {
  const redacted = redact(prompt);
  return {
    ...laneFromName(policy, policy.on_jev_down),
    signals: fallbackSignals(redacted, hasImage),
    reason: [reason],
    prompt_chars: redacted.length,
    jev_ms: jevMs,
    degraded: true,
  };
}

export async function decideTurn(
  policy: Policy,
  prompt: string,
  extras: {
    hasImage?: boolean;
    retry?: boolean;
    previousLane?: string;
    previousTask?: string;
  } = {},
): Promise<Decision> {
  const redacted = redact(prompt);
  const hasImage = extras.hasImage ?? false;
  const started = Date.now();
  let signals: Signals;
  try {
    const response = await callJev(
      {
        task: redacted,
        has_image: hasImage,
        retry: Boolean(extras.retry),
        previous_lane: extras.previousLane ?? null,
        ...(extras.previousTask && { previous_task: redact(extras.previousTask, 512) }),
      },
      policy,
    );
    signals = answersToSignals(answerRecord(response, "response").answers, hasImage);
  } catch (err) {
    if (!(err instanceof JevUnavailable)) throw err;
    return fallbackTurn(policy, redacted, hasImage, "Jev unavailable or invalid, using fallback lane", Date.now() - started);
  }
  return applyPolicy(policy, signals, {
    jev_ms: Date.now() - started,
    prompt_chars: redacted.length,
  });
}
