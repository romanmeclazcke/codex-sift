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
  {
    q: "How much quota can routing save?",
    a: "On twelve live Jev prompts in reports/e2e-routing.md, estimated quota fell from 16.2 to 7.5 versus an always-forge baseline, a 53.7% cut. That measures routing cost, not answer quality.",
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
  usage: number;
  saved: number;
  examples: readonly string[];
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
    usage: 0.17,
    saved: 87.0,
    examples: [
      "Rename getUser to fetchUser in src/api.ts",
      "Fix the typo in the empty-state heading",
      "Find the command that runs the unit tests",
    ],
  },
  craft: {
    id: "craft",
    model: "gpt-5.6-terra",
    effort: "medium",
    use: "Normal implementation and bounded debugging",
    short: "everyday work",
    rules: ["needs real diagnosis", "everyday implementation", "default balanced lane"],
    usage: 0.55,
    saved: 59.3,
    examples: [
      "Extract the fetch in page.tsx into a reusable hook",
      "Fix the search results that go stale when filters change quickly",
      "Add pagination to the activity feed and preserve the selected filters",
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
    usage: 1.35,
    saved: 0,
    examples: [
      "Find why the auth test fails only when the full suite runs",
      "Plan a zero-downtime migration for a shared production database",
      "Diagnose duplicate payments across retries, webhooks, and workers",
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

export type CaseResult = {
  id: string;
  prompt: string;
  lane: LaneId;
  expected: LaneId;
  usage: number;
  saved: number;
};

/** The 12 representative cases from reports/e2e-routing.md (live Jev, always-forge baseline 1.35 each). */
export const E2E_CASES: CaseResult[] = [
  { id: "ask-basic", prompt: "what does package.json do in a Node project?", lane: "flash", expected: "flash", usage: 0.17, saved: 87.0 },
  { id: "repo-command", prompt: "how do I run the unit tests in this repo?", lane: "flash", expected: "flash", usage: 0.17, saved: 87.0 },
  { id: "small-rename", prompt: "rename getUser to fetchUser in src/api.ts", lane: "flash", expected: "flash", usage: 0.17, saved: 87.0 },
  { id: "small-ui", prompt: "add a loading spinner to the submit button in LoginForm.tsx", lane: "craft", expected: "craft", usage: 0.55, saved: 59.3 },
  { id: "react-explain", prompt: "explain what useMemo is for in this React component", lane: "flash", expected: "flash", usage: 0.17, saved: 87.0 },
  { id: "hook-extract", prompt: "extract the fetch in page.tsx into a reusable hook", lane: "craft", expected: "craft", usage: 0.55, saved: 59.3 },
  { id: "timezone-test", prompt: "the test formatDate.test.ts is failing on timezone, fix the assertion", lane: "craft", expected: "craft", usage: 0.55, saved: 59.3 },
  { id: "typescript-error", prompt: "this TypeScript error: Type X is not assignable to type Y on the props", lane: "craft", expected: "craft", usage: 0.55, saved: 59.3 },
  { id: "suite-leak", prompt: "the auth test fails only when run with the full suite, find the leak", lane: "forge", expected: "forge", usage: 1.35, saved: 0 },
  { id: "auth-redesign", prompt: "redesign authentication across the Next.js app and the API gateway", lane: "forge", expected: "forge", usage: 1.35, saved: 0 },
  { id: "websocket-race", prompt: "debug a race in websocket reconnect that duplicates subscriptions", lane: "craft", expected: "forge", usage: 0.55, saved: 59.3 },
  { id: "prod-migration", prompt: "ship a production database migration that changes user permissions and preserves existing sessions", lane: "forge", expected: "forge", usage: 1.35, saved: 0 },
];

export const E2E_SUMMARY = {
  cases: 12,
  live: 12,
  degraded: 0,
  match: "11/12",
  avgJevMs: 418,
  baseline: 16.2,
  routed: 7.5,
  saved: 53.7,
  mix: { flash: 4, craft: 5, forge: 3 } as Record<LaneId, number>,
};

export const STEPS = [
  {
    n: "01",
    title: "Intercepts the Responses call",
    tag: "model_provider",
    body: "Codex has no hook that changes the model before a turn is billed. Sift starts a loopback Responses proxy and launches Codex with process-local -c overrides. TUI, sessions and sandbox stay native.",
  },
  {
    n: "02",
    title: "Asks Jev six atomic questions",
    tag: "TypeSafe Jev",
    body: "On every user turn Sift asks Jev for task_kind, difficulty, needs_reasoning, needs_planning, high_stakes and cross_cutting. Typed signals come back in about 300 ms. Jev never writes code or picks a model.",
  },
  {
    n: "03",
    title: "Maps signals with policy.yaml",
    tag: "first match wins",
    body: "YAML rules turn those signals into flash, craft or forge. If Jev times out or the key is missing, Sift fails open to on_jev_down (default craft) and marks the decision degraded.",
  },
  {
    n: "04",
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
