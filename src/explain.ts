import { loadPolicy } from "./policy.js";
import { readLast } from "./log.js";

export function runExplain(): number {
  const last = readLast();
  if (!last) {
    process.stdout.write("No Sift decision yet. Run `codex-sift` and send a prompt first.\n");
    return 1;
  }
  const policy = loadPolicy();
  const lines = [
    `at: ${last.at}`,
    `lane: ${last.lane} -> ${last.model}${last.effort ? ` (effort ${last.effort})` : ""}`,
    `degraded: ${last.degraded ? "yes" : "no"}`,
    `jev_ms: ${last.jev_ms}`,
    `reason: ${last.reason.join("; ")}`,
    `task_kind: ${last.signals.task_kind} (confidence ${last.signals.task_kind_confidence.toFixed(2)})`,
    `difficulty: ${last.signals.difficulty.toFixed(2)} (confidence ${last.signals.difficulty_confidence.toFixed(2)})`,
    `confidence used: ${last.signals.confidence.toFixed(2)}`,
    `is_chitchat: ${last.signals.is_chitchat.toFixed(2)}`,
    `needs_reasoning: ${last.signals.needs_reasoning.toFixed(2)}`,
    `needs_planning: ${last.signals.needs_planning.toFixed(2)}`,
    `high_stakes: ${last.signals.high_stakes.toFixed(2)}`,
    `cross_cutting: ${last.signals.cross_cutting.toFixed(2)}`,
    `prompt: ${last.prompt_preview}`,
    `lanes: ${Object.entries(policy.lanes).map(([k, v]) => `${k}=${v.model}`).join(", ")}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
