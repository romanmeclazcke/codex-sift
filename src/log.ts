import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, fchmodSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siftHome } from "./policy.js";
import { redact } from "./redact.js";
import type { Decision, Policy } from "./types.js";
import type { RequestOutcome } from "./upstream.js";
import { snapshotWeights, type WeightSnapshot } from "./usage.js";

type DecisionContext = { source?: "preview" | "proxy"; session_id?: string; task_id?: string; policy?: Policy };
let warnedAboutTelemetry = false;

export type DecisionRecord = Decision & {
  at: string;
  source?: "preview" | "proxy";
  session_id?: string;
  task_id?: string;
  weights?: WeightSnapshot;
  prompt_preview?: string;
};

export type OutcomeRecord = RequestOutcome & {
  at: string;
  session_id: string;
  task_id: string;
  request_kind: "initial" | "continuation";
};

export function lastPath(): string {
  return join(siftHome(), "last.json");
}

export function logPath(): string {
  return join(siftHome(), "decisions.jsonl");
}

function outcomePath(): string {
  return join(siftHome(), "outcomes.jsonl");
}

function appendPrivate(path: string, record: DecisionRecord | OutcomeRecord): void {
  const file = openSync(path, "a", 0o600);
  try {
    fchmodSync(file, 0o600);
    appendFileSync(file, `${JSON.stringify(record)}\n`);
  } finally {
    closeSync(file);
  }
}

function replaceLast(record: DecisionRecord): void {
  const temp = join(siftHome(), `.last-${randomUUID()}.json`);
  try {
    writeFileSync(temp, JSON.stringify(record, null, 2), { mode: 0o600, flag: "wx" });
    renameSync(temp, lastPath());
  } catch (err) {
    try {
      unlinkSync(temp);
    } catch {
      // The temporary file might not have been created.
    }
    throw err;
  }
}

function writeTelemetry(write: () => void): void {
  try {
    mkdirSync(siftHome(), { recursive: true, mode: 0o700 });
    write();
  } catch {
    if (warnedAboutTelemetry) return;
    warnedAboutTelemetry = true;
    process.emitWarning("Codex Sift could not write local routing telemetry.");
  }
}

export function writeDecision(decision: Decision, prompt: string, context: DecisionContext = {}): DecisionRecord {
  const record: DecisionRecord = {
    ...decision,
    at: new Date().toISOString(),
    source: context.source ?? "proxy",
    session_id: context.session_id,
    task_id: context.task_id,
    weights: context.policy && snapshotWeights(context.policy),
  };
  if (process.env.SIFT_LOG_PROMPT_PREVIEW === "1") {
    record.prompt_preview = redact(prompt, Infinity).replace(/[\s\p{Cc}\p{Cf}]+/gu, " ").trim().slice(0, 180);
  }
  if (record.source !== "preview") writeTelemetry(() => appendPrivate(logPath(), record));
  writeTelemetry(() => replaceLast(record));
  return record;
}

export function writeOutcome(outcome: Omit<OutcomeRecord, "at">): void {
  const record = { ...outcome, at: new Date().toISOString() };
  writeTelemetry(() => appendPrivate(outcomePath(), record));
}

function parseRecord<T>(text: string, valid: (value: T) => boolean): T | null {
  try {
    const value = JSON.parse(text) as T;
    return value && valid(value) ? value : null;
  } catch {
    return null;
  }
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function isDecision(value: DecisionRecord): boolean {
  return typeof value.at === "string" && typeof value.lane === "string" && typeof value.model === "string";
}

function isOutcome(value: OutcomeRecord): boolean {
  return typeof value.at === "string" && typeof value.task_id === "string" && typeof value.session_id === "string"
    && typeof value.latency_ms === "number" && ["completed", "failed", "incomplete", "canceled"].includes(value.outcome);
}

function readRecords<T>(path: string, valid: (value: T) => boolean): T[] {
  const records: T[] = [];
  for (const line of readFile(path).split("\n")) {
    if (!line) continue;
    const record = parseRecord<T>(line, valid);
    if (record) records.push(record);
  }
  return records;
}

export function readLast(): DecisionRecord | null {
  return parseRecord<DecisionRecord>(readFile(lastPath()), isDecision);
}

export function readLog(): DecisionRecord[] {
  return readRecords(logPath(), isDecision);
}

export function readOutcomes(): OutcomeRecord[] {
  return readRecords(outcomePath(), isOutcome);
}
