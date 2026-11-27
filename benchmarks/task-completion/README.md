# Repository task completion benchmark

The suite compares the bundled policy’s fixed forge model and reasoning effort with the normal Codex Sift proxy using live Jev. It covers three small, reproducible Git repositories with different kinds of work. The [task manifest](tasks.json) contains the exact task prompts and the source files the grader accepts. Each fixture uses the Node.js test runner and the standard library.

## Run the benchmark

Use Node.js 20+, Git with SHA-1 object format support, and the current fixture and policy files from a checkout of this repository.

```sh
npm ci
npm run benchmark:tasks:smoke
```

The smoke uses a deterministic local stand-in. It verifies that each public suite passes on the base commit, the separate acceptance checks reject the base, the supplied passing changes are recognized, retries and terminal failures are counted, and missing token fields remain unavailable. It makes no model or classifier requests.

For live measurements, sign into the Codex CLI with ChatGPT or `codex login --with-api-key` and configure `TYPESAFE_API_KEY` in the environment or with `codex-sift setup`. Use the same account and provider settings for the two arms.

```sh
npm run benchmark:tasks -- --live --trials 3 --out reports/task-completion.json
```

The live command can contact Codex and Jev and consume usage. With three tasks and three trials per strategy, it runs 18–36 Codex attempts and one Jev classification per routed attempt that reaches the proxy. `--timeout-seconds` caps each agent attempt and defaults to 300. The runner writes a versioned JSON report after all trials. A failed preflight leaves an existing report intact. `--out` can write to a separate path while reviewing a run.

## Trial and scoring rules

- Each task runs with both strategies in paired trials. Their order alternates by task and trial. The runner builds an independent Git repository at the same deterministic base commit for each strategy and trial. Both strategies get the same prompt, time limit and workspace-write sandbox. Each starts an ephemeral Codex session with user config and user rules ignored.
- Up to two attempts count toward completion. A retry keeps the first attempt’s working tree and starts a fresh CLI invocation with the same generic retry instruction. A pass requires a completed Codex attempt, a recorded proxy decision for Sift, and a successful independent grade. The grade copies only the named source files into a separate directory and runs the original public tests and the acceptance tests. Test-file edits in the agent checkout have no effect on the score. The public benchmark includes its acceptance tests for reproducibility.
- First-try and completion rates use all trials, including CLI and infrastructure failures. Time to completion includes agent startup, routing, editing, grading and retries, excluding fixture preparation. Failed trials have no time to completion and contribute to total wall time. The report also records individual attempt and grader durations.
- When Codex reports token usage, the report stores input, cached input, cache-write input, output and reasoning output fields separately. Totals include retries and failed attempts with usage. Missing fields stay null, and each total carries the count of attempts with reported values so partial totals remain visible. Sift records per-attempt live and fallback decisions and the number of attempts without a decision. The report measures CLI usage rather than subscription quota, bills or TypeSafe consumption.
- The report records the runner’s source revision, a digest for tracked source changes, Node and Codex versions, policy digests, model and reasoning settings, fixture hashes, base commits, and each attempt’s outcomes. Model versions, provider cache state and authentication can affect reproduction. The workload is three synthetic repos and supports conclusions about these tasks and settings.
