import { loadPolicy } from "./policy.js";
import { readLast, readOutcomes } from "./log.js";

export function runExplain(): number {
  const last = readLast();
  if (!last) {
    process.stdout.write("No Sift decision yet. Run `codex-sift` and send a prompt first.\n");
    return 1;
  }
  const policy = loadPolicy();
  const number = (value: unknown) => typeof value === "number" ? value.toFixed(2) : "unknown";
  const signals = last.signals;
  const lines = [
    `at: ${last.at}`,
    `lane: ${last.lane} -> ${last.model}${last.effort ? ` (effort ${last.effort})` : ""}`,
    `degraded: ${last.degraded ? "yes" : "no"}`,
    `jev_ms: ${last.jev_ms}`,
    `reason: ${Array.isArray(last.reason) ? last.reason.join(" | ") : "unknown"}`,
    `task_kind: ${signals?.task_kind ?? "unknown"} (confidence ${number(signals?.task_kind_confidence)})`,
    `difficulty: ${number(signals?.difficulty)} (confidence ${number(signals?.difficulty_confidence)})`,
    `confidence used: ${number(signals?.confidence)}`,
    `is_chitchat: ${number(signals?.is_chitchat)}`,
    `needs_reasoning: ${number(signals?.needs_reasoning)}`,
    `needs_planning: ${number(signals?.needs_planning)}`,
    `high_stakes: ${number(signals?.high_stakes)}`,
    `cross_cutting: ${number(signals?.cross_cutting)}`,
    `lanes: ${Object.entries(policy.lanes).map(([k, v]) => `${k}=${v.model}`).join(", ")}`,
  ];
  if (last.source === "preview") lines.push("source: routing preview");
  if (last.task_id) {
    const latest = readOutcomes().reverse().find((outcome) => outcome.task_id === last.task_id && outcome.session_id === last.session_id);
    lines.push(`latest response: ${latest ? `${latest.outcome} (${latest.latency_ms} ms upstream)` : "unobserved"}`);
    if (latest?.usage) {
      lines.push(`measured tokens: ${Object.entries(latest.usage).map(([field, count]) => `${field} ${count}`).join(", ")}`);
    }
  }
  if (last.source && process.env.SIFT_LOG_PROMPT_PREVIEW === "1" && last.prompt_preview) {
    lines.push(`prompt preview: ${last.prompt_preview}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
