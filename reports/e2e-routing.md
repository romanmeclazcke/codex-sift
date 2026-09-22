# Codex Sift E2E Routing Report

Generated: 2026-09-22T00:42:49.864Z

## Summary

- Cases: 12
- Live Jev cases: 12
- Degraded cases: 0
- Policy expectation match: 11/12 (91.7%)
- Average Jev latency: 418 ms
- Baseline: every live turn on gpt-5.6-sol
- Usage: 16.20 -> 7.50
- Estimated quota saved: 53.7%



## Lane Mix

- craft: 5
- flash: 4
- forge: 3

## Case Results

| ID | Category | Policy expected | Actual | Model | Effort | Policy match | Degraded | Jev ms | Usage | Saved vs forge | Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| ask-basic | Ask | flash | flash | gpt-5.6-luna | low | yes | no | 917 | 0.17 | 87.0% | what does package.json do in a Node project? |
| repo-command | Ops | flash | flash | gpt-5.6-luna | low | yes | no | 813 | 0.17 | 87.0% | how do I run the unit tests in this repo? |
| small-rename | Localized edit | flash | flash | gpt-5.6-luna | low | yes | no | 339 | 0.17 | 87.0% | rename getUser to fetchUser in src/api.ts |
| small-ui | Localized edit | craft | craft | gpt-5.6-terra | medium | yes | no | 334 | 0.55 | 59.3% | add a loading spinner to the submit button in LoginForm.tsx |
| react-explain | Ask | flash | flash | gpt-5.6-luna | low | yes | no | 294 | 0.17 | 87.0% | explain what useMemo is for in this React component |
| hook-extract | Implementation | craft | craft | gpt-5.6-terra | medium | yes | no | 302 | 0.55 | 59.3% | extract the fetch in page.tsx into a reusable hook |
| timezone-test | Debug | craft | craft | gpt-5.6-terra | medium | yes | no | 300 | 0.55 | 59.3% | the test formatDate.test.ts is failing on timezone, fix the assertion |
| typescript-error | Debug | craft | craft | gpt-5.6-terra | medium | yes | no | 358 | 0.55 | 59.3% | this TypeScript error: Type X is not assignable to type Y on the props |
| suite-leak | Debug | forge | forge | gpt-5.6-sol | high | yes | no | 336 | 1.35 | 0.0% | the auth test fails only when run with the full suite, find the leak |
| auth-redesign | Architecture | forge | forge | gpt-5.6-sol | high | yes | no | 318 | 1.35 | 0.0% | redesign authentication across the Next.js app and the API gateway |
| websocket-race | Hard debug | forge | craft | gpt-5.6-terra | medium | no | no | 365 | 0.55 | 59.3% | debug a race in websocket reconnect that duplicates subscriptions |
| prod-migration | High stakes | forge | forge | gpt-5.6-sol | high | yes | no | 336 | 1.35 | 0.0% | ship a production database migration that changes user permissions and preserves existing sessions |

## Interpretation

Sift is compared against an always-forge baseline. This report measures routing and quota efficiency, not answer quality. The policy expectation column validates whether each representative prompt landed on the lane this repository expects. A case is counted as savings evidence only when Jev answered live; degraded fallback cases are listed for reliability tracking but excluded from the savings calculation.
