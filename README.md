# Codex Sift

Sift is a model router for the [OpenAI Codex CLI](https://developers.openai.com/codex). It keeps the native Codex experience, but routes each user turn to the cheapest model lane that should be able to handle it.

The problem is simple: coding sessions mix tiny asks, everyday implementation, and genuinely hard work. Running every turn on the strongest model is easy, but it spends premium quota on prompts like “explain this file”, “run the tests”, or “rename this helper”. Sift adds a small decision layer before Codex spends the turn.

On every **user turn**, Sift asks [TypeSafe Jev](https://docs.typesafe.ai) how hard the task is. Your YAML policy then picks a lane — **flash**, **craft**, or **forge** — and Codex runs against that model. You still talk to the native TUI.

Jev does not write code. It returns typed signals in about 300 ms. Sift’s YAML policy turns those signals into a model id.

This is a Codex-only router. It is not an MCP server, and it does not patch `~/.codex/config.toml`.

## Current E2E result

The latest routing report in this repository was generated with:

```bash
npm run e2e:report
```

Result:

| Metric | Value |
|---|---:|
| Representative cases | 12 |
| Live Jev cases | 12 |
| Degraded cases | 0 |
| Policy expectation match | 11/12 |
| Average Jev latency | 418 ms |
| Always-forge baseline | 16.20 |
| Sift routed usage | 7.50 |
| Estimated quota saved | 53.7% |

See [reports/e2e-routing.md](reports/e2e-routing.md) for the full table.

This measures routing and quota efficiency against an always-forge baseline. It does not claim answer quality unless you run and score the same prompts through Codex.

## Why this shape

Codex has no hook that can change the model *before* a turn is billed. The supported interception point is a custom `model_provider`. Sift starts a loopback Responses proxy, launches Codex with process-local `-c` overrides, and forwards your existing ChatGPT or API-key login upstream.

```text
you → codex-sift → Codex TUI
                      │
                      POST /responses  model=sift
                      │
                 Sift proxy (127.0.0.1)
                      │  Jev + policy.yaml
                      └─► chatgpt.com/backend-api/codex  or  api.openai.com
```

If you pin another model in `/model`, routing pauses. Pick **Sift** again to resume.

## Install

```bash
cd codex-sift
npm install
npm run build
npm link
codex-sift setup
```

`setup` lists your Codex models as `1, 2, 3`. You pick one for **flash**, **craft**, and **forge**. It can also save `TYPESAFE_API_KEY` to `~/.codex-sift/env` (mode 600) so you do not have to export it every session.

## Onboarding

The onboarding flow has three steps.

First, choose the concrete Codex model behind each lane:

```bash
codex-sift setup
```

The default mental model is:

| Lane | Use it for |
|---|---|
| `flash` | Questions, small ops, tiny edits |
| `craft` | Normal implementation and bounded debugging |
| `forge` | Hard diagnosis, architecture, auth, migrations, production-risk work |

Second, sanity-check your environment:

```bash
codex-sift doctor
```

This confirms Codex is available, your auth mode is detected, and the TypeSafe key is present for live Jev routing.

Third, start Codex through Sift from any project:

```bash
cd /path/to/your-project
codex-sift
```

`codex-sift` takes the same arguments as `codex`. Sessions, tools, sandbox, `/resume`, and permissions stay native.

```bash
codex-sift exec "explain src/cli.ts"
codex-sift resume --last
```

After any routed turn, inspect the latest decision:

```bash
codex-sift explain
```

Or, from inside Codex, use `$sift-explain`.

## Commands

| Command | Purpose |
|---|---|
| `codex-sift setup` | Onboarding: pick lane models by number |
| `codex-sift models` | Print the numbered Codex catalog |
| `codex-sift` | Interactive Codex with routing |
| `codex-sift route "…"` | Decide a lane; do not start Codex |
| `codex-sift explain` | Print the last decision |
| `codex-sift report` | Quota saved vs always-forge (`--live`, `--since=today`, `--json`) |
| `codex-sift demo` | Classify a sample coding day with Jev; no Codex usage |
| `codex-sift doctor` | Codex binary, auth, Jev key |
| `codex-sift init` | Copy `policy.yaml` to `~/.codex-sift/` |
| `--sift-off` | Bypass the proxy for one invocation |

Inside Codex, `$sift-explain` (skill installed on launch) reads `~/.codex-sift/last.json`.

## Show the savings

Codex with a ChatGPT subscription bills **quota**, not API invoices. Sift’s claim is: the same coding day uses fewer forge-tier turns.

1. Work normally through `codex-sift` for a session.
2. In another terminal:

```bash
codex-sift report --live --since=today
```

That prints lane mix and “usage vs always-Sol”. Degraded turns (Jev down) are excluded so the number is not inflated.

To show the idea without burning Codex quota, Jev-classify a canned day:

```bash
codex-sift demo
```

For a publishable E2E report with per-case tables:

```bash
npm run e2e:report
```

The E2E battery calls Jev for representative coding-agent prompts, compares each route against an always-forge baseline, and writes both human-readable Markdown and machine-readable JSON. It measures routing and quota efficiency; it does not claim response quality unless you manually run the same prompts through Codex and score the answers.

Weights live in `policy.yaml` as `usage_weight` × `effort_weight`. Tune them against `/usage` after a week of real sessions.

## Lanes

Edit the lanes in `~/.codex-sift/policy.yaml`, or run `codex-sift setup` again and type `1`, `2`, `3`. First matching rule wins.

| Lane | Default model | Use |
|---|---|---|
| `flash` | `gpt-5.6-luna` | Lookups, ops, tiny edits |
| `craft` | `gpt-5.6-terra` | Everyday implementation |
| `forge` | `gpt-5.6-sol` | Hard, high-stakes, or uncertain work |

Jev is asked atomic questions (`task_kind`, `difficulty`, `needs_reasoning`, `needs_planning`, `high_stakes`, `cross_cutting`). The policy never asks Jev “which model?”.

If Jev times out or `TYPESAFE_API_KEY` is missing, Sift fail-opens to `on_jev_down` (default `craft`) and marks the decision `degraded`.

## What is not routed

- Tool-loop continuations of the same user turn (the chosen model stays pinned)
- `codex-auto-review` and compact/review prompts
- Codex housekeeping that is not a `/responses` call
- Invocations with `-m` / `--model` pointing at a real model

## Auth

Sift does not read your tokens to call OpenAI. Codex sends `Authorization` and, on ChatGPT login, `chatgpt-account-id`. The proxy forwards those headers:

- ChatGPT / OAuth → `https://chatgpt.com/backend-api/codex/responses`
- API key → `https://api.openai.com/v1/responses`

A ChatGPT token is not valid on the platform API. Do not point this proxy at `api.openai.com` while logged in with ChatGPT.

## Status line (optional)

```toml
# ~/.codex/config.toml
statusLine = "node /absolute/path/to/codex-sift/scripts/statusline.js"
```

## Model and context indicators

Sift appends a small italic footer to routed, uncompressed streamed text responses:

```text
Model used: gpt-5.6-terra · craft
Estimated context after response: 58% used
Token headroom: 82% · Task-adjusted headroom (Jev): 78%
```

These are heuristic capacity indicators, **not** calibrated probabilities of a
correct answer or actual Codex token-usage figures. The scores are calculated
for the context at the end of the response, including an estimate of the response
text's tokens. Sift never pauses
or blocks execution because of these scores. If Jev is unavailable, the token-only
score still appears and the task-adjusted field says `unavailable`. Set
`SIFT_RESPONSE_FOOTER=0` to disable the footer.
Non-SSE or compressed responses are forwarded unchanged; Sift omits the footer
for those responses rather than altering their encoding or content.

## Context effectiveness estimate

Sift estimates input tokens before each new user turn, reads the selected model's
context window from Codex's local model catalog, and asks Jev whether the task is
likely to need substantial additional context. The request is always sent to the
selected Codex model. When streamed response text is complete, Sift estimates its
tokens too and displays the resulting context state in the response footer.

The task-adjusted score measures pressure from the request plus response text
relative to the context window and likely context growth. It does not
measure prompt quality, intrinsic task difficulty, or actual success probability.
Input tokens are estimated as the UTF-8 byte length of the JSON request divided
by four; response text uses the same approximation. Neither is counted with the
model tokenizer. Hidden reasoning, tool payloads, images, and other non-text
content can make the end-of-turn state especially uncertain.
By default, both scores remain 100 while estimated input uses up to 50% of the
window. Context pressure rises between 50% and 95%; Jev's estimate of likely
additional context controls how strongly that pressure lowers the task-adjusted
score. Jev is called for each new task so both scores can appear in the response
footer. If Jev is unavailable, the task-adjusted score is omitted, but execution
continues normally.

The scoring rule is deliberately simple. Let `p` be context pressure, linearly
scaled from 0 at `full_score_until_percent` to 1 at
`max_pressure_at_percent`, and let `g` be Jev's 0–1 estimate that substantial
additional context will be needed. Then `token-only = round(100 × (1 − p))`
and `task-adjusted = round(token-only × (1 − 0.35 × g × p))`. At or above
`max_pressure_at_percent`, both scores are 0. The 0.35 adjustment is a heuristic,
not an empirically calibrated value.

Configure it in `~/.codex-sift/policy.yaml`:

```yaml
effectiveness:
  context_window_tokens: 0 # 0 = use Codex's model catalog
  full_score_until_percent: 50 # no context penalty up to this occupancy
  max_pressure_at_percent: 95 # full context penalty at this occupancy
```

For a 272,000-token window, the defaults mean no context penalty up to roughly
136,000 estimated input tokens and maximum context pressure at roughly 258,400.
These values are policy thresholds, not measured model-performance guarantees.
The first percentage must be lower than the second; both are percentages of the
selected model's window. Set `context_window_tokens` to a positive number only
when you want to override the catalog's total window size.

## Configuration

| Variable | Meaning |
|---|---|
| `TYPESAFE_API_KEY` | Jev credentials |
| `TYPESAFE_BASE_URL` | Override, default `https://api.typesafe.ai` |
| `SIFT_POLICY` | Extra YAML overlay |
| `SIFT_HOME` | Default `~/.codex-sift` |
| `SIFT_DISABLED=1` | Disable routing |
| `SIFT_RESPONSE_FOOTER=0` | Disable the response footer |
| `CODEX_BIN` | Codex executable if it is not on `PATH` |
| `SIFT_CHATGPT_ORIGIN` / `SIFT_OPENAI_ORIGIN` | Test upstreams |

Pin `jev_model` in YAML (`jev-1.13.0`). Do not ship thresholds against `jev-latest`.

## Development

```bash
npm test
npm run build
npx tsx src/cli.ts route "rename the unused helper"
```

## License

MIT
