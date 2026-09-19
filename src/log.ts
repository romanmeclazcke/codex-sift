import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { siftHome } from "./policy.js";
import type { Decision } from "./types.js";

export type DecisionRecord = Decision & {
  at: string;
  prompt_preview: string;
};

export function lastPath(): string {
  return join(siftHome(), "last.json");
}

export function logPath(): string {
  return join(siftHome(), "decisions.jsonl");
}

export function writeDecision(decision: Decision, prompt: string): DecisionRecord {
  mkdirSync(siftHome(), { recursive: true });
  const record: DecisionRecord = {
    ...decision,
    at: new Date().toISOString(),
    prompt_preview: prompt.replace(/\s+/g, " ").slice(0, 180),
  };
  writeFileSync(lastPath(), JSON.stringify(record, null, 2));
  appendFileSync(logPath(), `${JSON.stringify(record)}\n`);
  return record;
}

export function readLast(): DecisionRecord | null {
  if (!existsSync(lastPath())) return null;
  return JSON.parse(readFileSync(lastPath(), "utf8")) as DecisionRecord;
}

export function readLog(): DecisionRecord[] {
  if (!existsSync(logPath())) return [];
  return readFileSync(logPath(), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DecisionRecord);
}
