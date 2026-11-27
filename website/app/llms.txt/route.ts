import { CLI_COMPARISON, ROUTING_BENCHMARK as routing, TASK_COMPLETION, TOKEN_RESULT } from "@/lib/benchmark-data";
import { SITE_URL } from "@/lib/content";

export const dynamic = "force-static";

export function GET() {
  const taskStatus = TASK_COMPLETION.status === "measured"
    ? TOKEN_RESULT ?? "Tests score repository edits by first-try and overall completion, elapsed time and available CLI usage."
    : "The offline smoke is available. Live results are pending.";

  return new Response(`# Codex Sift

> An open-source model router for the OpenAI Codex CLI. It chooses a model and reasoning effort per turn while keeping the native Codex interface.

Codex Sift uses TypeSafe Jev to classify a redacted excerpt of each user turn. The YAML policy maps the result to a model and reasoning effort. Setup needs Node.js 20+, Codex CLI and a TypeSafe API key.

## Documentation

- [Homepage](${SITE_URL}/): how routing works and installation.
- [Reduce token usage in Codex CLI](${SITE_URL}/guides/en): model selection, context and measurement.
- [Reducir el consumo de Codex CLI](${SITE_URL}/guides/es): guide in Spanish.
- [Manual model switching vs Codex Sift](${SITE_URL}/compare): how to choose between workflows.
- [npm package](https://www.npmjs.com/package/codex-sift): install with \`npx codex-sift setup\`, then run \`npx codex-sift\`.
- [Source repository](https://github.com/romanmeclazcke/codex-sift): code and MIT license.

## Benchmarks

- [Routing benchmark and methodology](${SITE_URL}/benchmark#routing): on ${routing.date}, the policy estimated ${routing.saved}% less relative quota on ${routing.turns} prompts than routing every turn to forge.
- [Repository task benchmark](${SITE_URL}/benchmark#task-completion): ${taskStatus}
- [Repository run data](https://github.com/romanmeclazcke/codex-sift/blob/main/reports/task-completion.json): attempt-level token counts, test outcomes and elapsed time. Billed cost and subscription quota were outside the measurement.
- [Raw CLI comparison](https://github.com/romanmeclazcke/codex-sift/blob/main/reports/model-comparison.json): measured tokens, time and exact-answer scores from ${CLI_COMPARISON.tasks} short tasks under fixed, manual and Sift-selected modes.
- [Default policy](https://github.com/romanmeclazcke/codex-sift/blob/main/policy.yaml): routing rules and weights behind the quota estimate.
`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
