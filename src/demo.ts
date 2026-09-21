import { decideTurn } from "./jev.js";
import { loadPolicy } from "./policy.js";
import { formatUsage, summarizeUsage } from "./usage.js";

export const DEMO_PROMPTS = [
  "hola",
  "what does this repository do?",
  "rename the unused helper in utils.ts",
  "git status and commit the typo fix",
  "explain the function that builds the nav",
  "the test in auth.test.ts is failing, find why",
  "add a loading spinner to the submit button",
  "thanks",
  "redesign auth across billing and the API gateway",
  "stop the double fetch on the home page",
];

export async function runDemo(): Promise<number> {
  const policy = loadPolicy();
  if (!process.env.TYPESAFE_API_KEY) {
    process.stderr.write("codex-sift demo needs TYPESAFE_API_KEY so Jev can classify the sample day.\n");
    return 1;
  }
  process.stdout.write("Sample coding day (Jev only — Codex is not called)\n\n");
  const rows = [];
  for (const prompt of DEMO_PROMPTS) {
    const decision = await decideTurn(policy, prompt);
    rows.push(decision);
    const tag = decision.degraded ? " degraded" : "";
    process.stdout.write(
      `${decision.lane.padEnd(6)} ${decision.model.padEnd(14)} ${String(decision.effort || "").padEnd(7)} ${prompt}${tag}\n`,
    );
  }
  process.stdout.write(`\n${formatUsage(summarizeUsage(policy, rows))}\n`);
  process.stdout.write("That is the pitch: same work, less forge quota, because cheap turns never touch Sol.\n");
  return 0;
}
