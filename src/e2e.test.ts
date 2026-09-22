import assert from "node:assert/strict";
import test from "node:test";
import { formatMarkdownReport, type E2ERow } from "./e2e.js";
import { loadPolicy } from "./policy.js";

const rows: E2ERow[] = [
  {
    id: "ask-basic",
    category: "Ask",
    expectedLane: "flash",
    prompt: "what does package.json do?",
    actualLane: "flash",
    model: "gpt-5.6-luna",
    effort: "low",
    degraded: false,
    jevMs: 210,
    promptChars: 26,
    expectedMatch: true,
    baselineUsage: 1.35,
    actualUsage: 0.175,
    savedPct: 87.037,
    reason: "lookup or plumbing",
  },
  {
    id: "auth-redesign",
    category: "Architecture",
    expectedLane: "forge",
    prompt: "redesign auth across the app",
    actualLane: "forge",
    model: "gpt-5.6-sol",
    effort: "high",
    degraded: false,
    jevMs: 260,
    promptChars: 28,
    expectedMatch: true,
    baselineUsage: 1.35,
    actualUsage: 1.35,
    savedPct: 0,
    reason: "hard or novel work",
  },
  {
    id: "fallback",
    category: "Fallback",
    expectedLane: "craft",
    prompt: "fix a small bug",
    actualLane: "craft",
    model: "gpt-5.6-terra",
    effort: "medium",
    degraded: true,
    jevMs: 2500,
    promptChars: 15,
    expectedMatch: true,
    baselineUsage: 1.35,
    actualUsage: 0.55,
    savedPct: 59.259,
    reason: "Jev unavailable, using fallback lane",
  },
];

test("markdown e2e report includes summary and case table", () => {
  const markdown = formatMarkdownReport(loadPolicy(), rows, new Date("2026-09-21T12:00:00.000Z"));

  assert.match(markdown, /Cases: 3/);
  assert.match(markdown, /Live Jev cases: 2/);
  assert.match(markdown, /Degraded cases: 1/);
  assert.match(markdown, /Policy expectation match: 3\/3/);
  assert.match(markdown, /Usage: 2\.70 -> 1\.53/);
  assert.match(markdown, /\| ask-basic \| Ask \| flash \| flash \| gpt-5\.6-luna/);
  assert.match(markdown, /routing and quota efficiency, not answer quality/);
});
