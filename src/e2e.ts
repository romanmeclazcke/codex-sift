import { decideTurn } from "./jev.js";
import { loadPolicy } from "./policy.js";
import { formatUsage, summarizeUsage, turnCost } from "./usage.js";

export const PROGRAMMING_PROMPTS = [
  "what does package.json do in a Node project?",
  "how do I run the unit tests in this repo?",
  "rename getUser to fetchUser in src/api.ts",
  "git commit the typo fix with a conventional message",
  "explain what useMemo is for in this React component",
  "add a loading spinner to the submit button in LoginForm.tsx",
  "extract the fetch in page.tsx into a reusable hook",
  "the test formatDate.test.ts is failing on timezone, fix the assertion",
  "this TypeScript error: Type X is not assignable to type Y on the props",
  "the auth test fails only when run with the full suite, find the leak",
  "redesign authentication across the Next.js app and the API gateway",
  "debug a race in websocket reconnect that duplicates subscriptions",
];

export async function runE2E(): Promise<number> {
  const policy = loadPolicy();
  if (!process.env.TYPESAFE_API_KEY) {
    process.stderr.write("codex-sift e2e needs TYPESAFE_API_KEY. Export it in this terminal and retry.\n");
    return 1;
  }
  process.stdout.write("E2E programming session (Jev only — Codex quota is not used)\n\n");
  const rows = [];
  const forge = turnCost(policy, policy.lanes.forge.model, policy.lanes.forge.effort);
  for (const prompt of PROGRAMMING_PROMPTS) {
    const decision = await decideTurn(policy, prompt);
    rows.push(decision);
    const cost = turnCost(policy, decision.model, decision.effort);
    const vs = cost + 0.01 < forge ? `${(((forge - cost) / forge) * 100).toFixed(0)}% less` : "same (forge)";
    const tag = decision.degraded ? " [degraded]" : "";
    process.stdout.write(
      `${decision.lane.padEnd(6)} ${String(decision.model).padEnd(14)} ${String(decision.effort || "-").padEnd(7)} ${vs.padEnd(12)} ${prompt}${tag}\n`,
    );
  }
  process.stdout.write(`\n${formatUsage(summarizeUsage(policy, rows))}\n`);
  return rows.some((row) => row.degraded) ? 1 : 0;
}
