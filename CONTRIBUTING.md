# Contributing

Sift is a Codex-only model router. Keep Jev on the cheap decision path and Codex on the native TUI path.

## Rules of the road

- Do not add MCP. Routing has to happen before Codex spends a coding-model turn.
- Do not write provider settings into `~/.codex/config.toml`. Launch with process-local `codex -c`.
- Do not parse `auth.json` for tokens. Forward `Authorization` and `chatgpt-account-id`.
- Ask Jev for atomic signals. Map them to lanes in `policy.yaml`.
- Treat tool-loop `function_call_output` items as continuations of the current lane.
- Keep the Responses body intact except `model` and `reasoning.effort`.

## Tests

```bash
npm test
npm run build
```

Policy, redaction, turn detection, and the proxy rewrite are covered without a TypeSafe key. Live `codex-sift` still needs `TYPESAFE_API_KEY` and a working `codex login`.
