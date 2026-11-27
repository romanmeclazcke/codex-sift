import routing from "@/.generated/e2e-routing.json";
import comparison from "@/.generated/model-comparison.json";
import completion from "@/.generated/task-completion.json";

export function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

export const ROUTING_BENCHMARK = {
  ...routing.summary,
  date: date(routing.generatedAt),
  saved: Number(routing.summary.savedPct.toFixed(1)),
  match: routing.rows.filter((row) => row.expectedMatch).length,
  avgJevMs: routing.summary.liveTurns
    ? Math.round(routing.rows
        .filter((row) => !row.degraded)
        .reduce((total, row) => total + row.jevMs, 0) / routing.summary.liveTurns)
    : null,
  rows: routing.rows,
};

type Usage = { total: number | null; attempts_reported: number };
type QuestionResult = {
  task: string;
  strategy: string;
  correct?: boolean;
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
  seconds?: number;
  routing_ms?: number;
};

function observed(values: (number | undefined)[]): Usage {
  const reported = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    total: reported.length > 0 ? reported.reduce((sum, value) => sum + value, 0) : null,
    attempts_reported: reported.length,
  };
}

const questionRows: QuestionResult[] = comparison.rows;

export const CLI_COMPARISON = {
  date: date(comparison.date),
  tasks: new Set(questionRows.map((row) => row.task)).size,
  strategies: (["fixed", "manual", "sift"] as const).map((id) => {
    const rows = questionRows.filter((row) => row.strategy === id);
    return {
      id,
      count: rows.length,
      correct: rows.filter((row) => row.correct).length,
      input: observed(rows.map((row) => row.usage?.input_tokens)),
      cached: observed(rows.map((row) => row.usage?.cached_input_tokens)),
      output: observed(rows.map((row) => row.usage?.output_tokens)),
      time: observed(rows.map((row) => row.seconds === undefined ? undefined
        : (row.seconds * 1000) + (row.routing_ms ?? 0))),
    };
  }),
};

type StrategySummary = {
  trials: number;
  first_try: number;
  completed: number;
  attempts: number;
  agent_failures: number;
  total_ms: number;
  mean_time_to_completion_ms: number | null;
  usage: {
    input_tokens: Usage;
    cached_input_tokens: Usage;
    output_tokens: Usage;
  };
};
type TaskCompletion = {
  status: "pending" | "measured";
  generated_at: string | null;
  setup: {
    codex_cli: string;
    fixed: { model: string; effort?: string };
    trials_per_task: number;
    max_attempts: number;
  } | null;
  summary: {
    fixed: StrategySummary;
    sift: StrategySummary & {
      routing: { live: number; degraded: number; attempts_without_decision: number };
    };
  } | null;
};

export const TASK_COMPLETION = completion as TaskCompletion;

function reportedTokenTotal(strategy: StrategySummary) {
  const { input_tokens: input, output_tokens: output } = strategy.usage;
  if (input.total === null || output.total === null ||
      input.attempts_reported !== strategy.attempts || output.attempts_reported !== strategy.attempts) return null;
  return input.total + output.total;
}

function tokenResult(report: TaskCompletion, language: "en" | "es") {
  if (report.status !== "measured" || !report.setup || !report.summary) return null;
  const { fixed, sift } = report.summary;
  const baseline = reportedTokenTotal(fixed);
  const routed = reportedTokenTotal(sift);
  if (!baseline || routed === null || fixed.trials !== sift.trials) return null;
  const delta = (routed - baseline) / baseline;
  const percent = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(Math.abs(delta) * 100);
  const model = report.setup.fixed.model;
  if (language === "es") {
    return `En ${sift.trials} ejecuciones por estrategia, Codex Sift consumió ${percent} % ${delta > 0 ? "más" : "menos"} tokens de entrada y salida en total que el modelo fijo ${model}. La entrada incluye tokens en caché.`;
  }
  return `Across ${sift.trials} repository runs per strategy, Codex Sift used ${percent}% ${delta > 0 ? "more" : "fewer"} total input and output tokens than fixed-model ${model}. Input includes cached tokens.`;
}

export const TOKEN_RESULT = tokenResult(TASK_COMPLETION, "en");
export const TOKEN_RESULT_ES = tokenResult(TASK_COMPLETION, "es");
