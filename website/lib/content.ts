import { TOKEN_RESULT, ROUTING_BENCHMARK } from "@/lib/benchmark-data";

export const REPO_URL = "https://github.com/romanmeclazcke/codex-sift";
export const REPO_SLUG = "romanmeclazcke/codex-sift";
export const README_URL = `${REPO_URL}#readme`;
export const POLICY_URL = `${REPO_URL}/blob/main/policy.yaml`;
export const REPORT_URL = `${REPO_URL}/blob/main/reports/e2e-routing.md`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const NPM_URL = "https://www.npmjs.com/package/codex-sift";
export const JEV_DOCS_URL = "https://docs.typesafe.ai";
export const CODEX_URL = "https://developers.openai.com/codex";

/** Public site origin. Override with NEXT_PUBLIC_SITE_URL when you deploy. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://codex-sift.vercel.app";

export const AUTHOR = {
  name: "Roman Meclazcke",
  url: "https://github.com/romanmeclazcke",
  handle: "romanmeclazcke",
  x: "https://x.com/romanmeclazcke_",
  xHandle: "romanmeclazcke_",
  linkedin: "https://www.linkedin.com/in/roman-meclazcke",
} as const;

/** FAQ answers reused in the page body and JSON-LD for SEO / GEO. */
export const FAQ = [
  {
    q: "What is Codex Sift?",
    a: "Codex Sift is a model router for the OpenAI Codex CLI. It sends each user turn to the flash, craft or forge lane before Codex bills the turn.",
  },
  {
    q: "How does Codex Sift choose a model?",
    a: "On every user turn Sift asks TypeSafe Jev for typed signals such as task_kind and difficulty. Your policy.yaml maps those signals to a lane. First matching rule wins.",
  },
  {
    q: "Does Codex Sift change the Codex TUI?",
    a: "No. Sift launches Codex through a loopback model_provider. Sessions, tools and sandbox stay native to Codex.",
  },
  ...(TOKEN_RESULT ? [{ q: "How many tokens did Codex Sift save in the repository benchmark?", a: TOKEN_RESULT }] : []),
  {
    q: "How much quota can routing save?",
    a: `In a ${ROUTING_BENCHMARK.turns}-prompt routing test, the policy estimated ${ROUTING_BENCHMARK.saved}% less relative quota than always using forge. The estimate uses model and reasoning-effort weights.`,
  },
  {
    q: "Who built Codex Sift?",
    a: "Codex Sift was built by Roman Meclazcke (github.com/romanmeclazcke, x.com/romanmeclazcke_, linkedin.com/in/roman-meclazcke) and is released under the MIT license.",
  },
  {
    q: "How do I install Codex Sift?",
    a: "Install from npm with npm install -g codex-sift, then run codex-sift setup. You can also use npx codex-sift without a global install. The package is at npmjs.com/package/codex-sift.",
  },
] as const;

export type LaneId = "flash" | "craft" | "forge";

export type LaneInfo = {
  id: LaneId;
  model: string;
  effort: "low" | "medium" | "high";
  use: string;
  short: string;
  rules: string[];
  examples: readonly { prompt: string; reason: string; response: string }[];
};

/** Lane defaults, rules and example prompts come from policy.yaml, README.md and reports/e2e-routing.md. */
export const LANES: Record<LaneId, LaneInfo> = {
  flash: {
    id: "flash",
    model: "gpt-5.6-luna",
    effort: "low",
    use: "Questions, small ops, tiny edits",
    short: "small asks & edits",
    rules: ["greeting or chitchat", "lookup or plumbing", "localized cheap edit"],
    examples: [
      {
        prompt: "Rename getUser to fetchUser in src/api.ts",
        reason: "Small edit in one file",
        response: "Renamed getUser to fetchUser in src/api.ts.",
      },
      {
        prompt: "Fix the typo in the empty-state heading",
        reason: "Localized copy fix",
        response: "Corrected the typo in the empty-state heading.",
      },
      {
        prompt: "Find the command that runs the unit tests",
        reason: "Simple command lookup",
        response: "Run npm test to start the unit tests.",
      },
    ],
  },
  craft: {
    id: "craft",
    model: "gpt-5.6-terra",
    effort: "medium",
    use: "Normal implementation and bounded debugging",
    short: "everyday work",
    rules: ["needs real diagnosis", "everyday implementation", "default balanced lane"],
    examples: [
      {
        prompt: "Extract the fetch in page.tsx into a reusable hook",
        reason: "Bounded refactor with shared state",
        response: "Extracted the fetch logic into a reusable hook.",
      },
      {
        prompt: "Fix the search results that go stale when filters change quickly",
        reason: "Needs diagnosis of overlapping requests",
        response: "Discarded stale responses when filters change.",
      },
      {
        prompt: "Add pagination to the activity feed and preserve the selected filters",
        reason: "Feature spans pagination and filter state",
        response: "Added pagination and kept filters in the URL.",
      },
    ],
  },
  forge: {
    id: "forge",
    model: "gpt-5.6-sol",
    effort: "high",
    use: "Hard diagnosis, architecture, auth, migrations, production-risk work",
    short: "hard & high-stakes",
    rules: [
      "Jev unsure on non-trivial work, escalate",
      "high-stakes surface",
      "hard or novel work",
      "cross-cutting design",
    ],
    examples: [
      {
        prompt: "Find why the auth test fails only when the full suite runs",
        reason: "Auth failure depends on suite state",
        response: "Found a shared auth mock leaking between tests.",
      },
      {
        prompt: "Plan a zero-downtime migration for a shared production database",
        reason: "Production migration needs a rollout plan",
        response: "Outlined a staged migration with a rollback point.",
      },
      {
        prompt: "Diagnose duplicate payments across retries, webhooks, and workers",
        reason: "Retries can cause duplicate charges",
        response: "Found two retry paths that can process the same payment.",
      },
    ],
  },
};

export const LANE_ORDER: LaneId[] = ["flash", "craft", "forge"];

export const SIGNALS = [
  "task_kind",
  "difficulty",
  "needs_reasoning",
  "needs_planning",
  "high_stakes",
  "cross_cutting",
] as const;

export const STEPS = [
  {
    title: "Intercepts the Responses call",
    tag: "model_provider",
    body: "Codex has no hook that changes the model before a turn is billed. Sift starts a loopback Responses proxy and launches Codex with process-local -c overrides. TUI, sessions and sandbox stay native.",
  },
  {
    title: "Asks Jev six atomic questions",
    tag: "TypeSafe Jev",
    body: "On every user turn Sift asks Jev for task_kind, difficulty, needs_reasoning, needs_planning, high_stakes and cross_cutting. Typed signals come back in about 300 ms. Jev never writes code or picks a model.",
  },
  {
    title: "Maps signals with policy.yaml",
    tag: "first match wins",
    body: "YAML rules turn those signals into flash, craft or forge. If Jev times out or the key is missing, Sift fails open to on_jev_down (default craft) and marks the decision degraded.",
  },
  {
    title: "Rewrites model and effort only",
    tag: "model + reasoning.effort",
    body: "Only model and reasoning.effort change. Your ChatGPT or API-key login is forwarded upstream. Tool-loop continuations stay pinned to the chosen lane.",
  },
];

export const NOT_ROUTED = [
  "Tool-loop continuations of the same user turn",
  "codex-auto-review and compact/review prompts",
  "Codex housekeeping that is not a /responses call",
  "Invocations with -m / --model pointing at a real model",
];

export type Tab = { id: string; label: string; note: string; code: string };

export const TABS: Tab[] = [
  {
    id: "install",
    label: "Install",
    note: "Install from npm, then assign a model to flash, craft and forge.",
    code: `# recommended
npm install -g codex-sift
codex-sift setup

# or without a global install
npx codex-sift setup
npx codex-sift`,
  },
  {
    id: "run",
    label: "Run",
    note: "codex-sift accepts the same arguments as codex.",
    code: `# sanity-check Codex, auth mode and the TypeSafe key
codex-sift doctor

# start Codex through Sift from any project
cd /path/to/your-project
codex-sift

codex-sift exec "explain src/cli.ts"
codex-sift resume --last

# inspect the latest routing decision
codex-sift explain`,
  },
  {
    id: "savings",
    label: "Savings",
    note: "Quota saved versus an always-forge baseline. Degraded turns are excluded.",
    code: `# after a normal session, in another terminal
codex-sift report --live --since=today

# classify a canned coding day, no Codex usage
codex-sift demo

# publishable E2E report with per-case tables
npm run e2e:report`,
  },
  {
    id: "policy",
    label: "Policy",
    note: "Edit ~/.codex-sift/policy.yaml. Start with codex-sift init.",
    code: `# ~/.codex-sift/policy.yaml
jev_model: jev-1.13.0
on_jev_down: craft

lanes:
  flash: { model: gpt-5.6-luna,  effort: low }
  craft: { model: gpt-5.6-terra, effort: medium }
  forge: { model: gpt-5.6-sol,   effort: high }

rules:
  - when: "task_kind in [ask, ops] and difficulty < 1.3 and high_stakes < 0.4"
    lane: flash
    reason: lookup or plumbing
  - when: "high_stakes > 0.7"
    lane: forge
    reason: high-stakes surface`,
  },
];
