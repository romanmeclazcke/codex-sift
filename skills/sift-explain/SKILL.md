---
name: sift-explain
description: Explain why Codex Sift chose the current model lane for the last user turn
---

When the user asks why Sift picked a model, or invokes `$sift-explain`, read `~/.codex-sift/last.json`.

Summarize, without inventing numbers:

- lane and target Codex model
- effort
- the `reason` list
- task_kind, difficulty, needs_reasoning, high_stakes
- whether `degraded` is true (Jev was unavailable)

If the file is missing, say no turn has been routed yet and suggest `codex-sift route "..."`.
