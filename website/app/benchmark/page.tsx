import type { Metadata } from "next";
import Link from "next/link";
import tasks from "@/.generated/tasks.json";
import { ArticleJsonLd } from "@/components/JsonLd";
import { InstallActions } from "@/components/InstallActions";
import { CLI_COMPARISON, ROUTING_BENCHMARK as routing, TASK_COMPLETION, TOKEN_RESULT, date } from "@/lib/benchmark-data";
import { POLICY_URL, REPORT_URL, REPO_URL } from "@/lib/content";

const title = "Codex CLI routing and task completion benchmarks";
const description = TOKEN_RESULT ?? "Compare Codex Sift with a fixed model on repository tasks, short CLI questions and a routing workload.";
const labels = { fixed: "Always forge", manual: "Manual", sift: "Sift" };
const number = new Intl.NumberFormat("en-US");
const tableStyles = "w-full border-collapse text-left text-sm [&_td]:p-2 [&_th]:p-2";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/benchmark" },
  openGraph: { title, description, url: "/benchmark" },
  twitter: { card: "summary", title, description },
};

function seconds(milliseconds: number | null) {
  return milliseconds === null ? "Unavailable" : `${(milliseconds / 1000).toFixed(1)} s`;
}

function observedValue(value: { total: number | null; attempts_reported: number }, attempts: number, format: (value: number) => string = number.format) {
  if (value.total === null) return "Unavailable";
  const total = format(value.total);
  return value.attempts_reported === attempts ? total : `${total} (${value.attempts_reported}/${attempts} attempts)`;
}

function TaskCompletion() {
  const { generated_at: generatedAt, setup, summary } = TASK_COMPLETION;
  return (
    <section className="space-y-4" id="task-completion">
      <h2 className="text-2xl font-semibold">Repository task completion</h2>
      <p>The suite starts each strategy from the same fixture commit. It compares the forge model with Sift’s live proxy on {tasks.length} tasks covering {tasks.map((task) => task.kind.toLowerCase()).join(", ")}. Separate acceptance checks grade the resulting code alongside the fixture’s original tests.</p>
      {TASK_COMPLETION.status === "measured" && generatedAt && setup && summary ? (
        <>
          {TOKEN_RESULT && <p><strong>{TOKEN_RESULT}</strong> Billed cost, subscription quota and Jev usage were outside the scope of this run.</p>}
          <p>Run on {date(generatedAt)} using {setup.codex_cli}, with {setup.trials_per_task} trials per task and strategy and up to {setup.max_attempts} attempts per trial. The fixed strategy used {setup.fixed.model}{setup.fixed.effort ? ` at ${setup.fixed.effort} reasoning effort` : ""}.</p>
          <div className="overflow-x-auto">
            <table className={tableStyles}>
              <thead className="bg-wash">
                <tr><th scope="col">Measure</th><th scope="col">Always forge</th><th scope="col">Sift proxy</th></tr>
              </thead>
              <tbody>
                {[
                  ["First try", ...[summary.fixed, summary.sift].map((result) => `${result.first_try}/${result.trials}`)],
                  ["Completed within attempt limit", ...[summary.fixed, summary.sift].map((result) => `${result.completed}/${result.trials}`)],
                  ["Mean time to completion", ...[summary.fixed, summary.sift].map((result) => seconds(result.mean_time_to_completion_ms))],
                  ["Time across all trials", ...[summary.fixed, summary.sift].map((result) => seconds(result.total_ms))],
                  ["Agent failures", ...[summary.fixed, summary.sift].map((result) => `${result.agent_failures}/${result.attempts}`)],
                  ["Input tokens", ...[summary.fixed, summary.sift].map((result) => observedValue(result.usage.input_tokens, result.attempts))],
                  ["Cached input tokens", ...[summary.fixed, summary.sift].map((result) => observedValue(result.usage.cached_input_tokens, result.attempts))],
                  ["Output tokens", ...[summary.fixed, summary.sift].map((result) => observedValue(result.usage.output_tokens, result.attempts))],
                ].map(([label, fixed, sift]) => (
                  <tr key={label}><th scope="row">{label}</th><td>{fixed}</td><td>{sift}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Sift recorded {summary.sift.routing.live} live decisions and {summary.sift.routing.degraded} fallback decisions. {summary.sift.routing.attempts_without_decision} attempts had no recorded decision. Completion times include attempts and grading. Token totals use Codex CLI fields where reported, with partial coverage shown in parentheses.</p>
        </>
      ) : (
        <p>Live results are pending. The offline smoke test exercises scoring, retries, and usage reporting with a local stand-in for Codex.</p>
      )}
      <pre className="overflow-x-auto rounded-xl bg-wash p-4">{`npm ci
npm run benchmark:tasks:smoke

# Requires Codex authentication and a TypeSafe API key
npm run benchmark:tasks -- --live --out reports/task-completion.json`}</pre>
      <div className="flex flex-wrap gap-4">
        <a className="underline" href={`${REPO_URL}/blob/main/benchmarks/task-completion/README.md`}>Fixtures and scoring methodology</a>
        <a className="underline" href={`${REPO_URL}/blob/main/reports/task-completion.json`}>Versioned task results</a>
      </div>
    </section>
  );
}

export default function Benchmark() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-5 py-12">
      <ArticleJsonLd path="/benchmark" title={title} description={description} language="en" />
      <Link href="/">Codex Sift</Link>
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <TaskCompletion />
      <section className="space-y-4" id="routing">
        <h2 className="text-2xl font-semibold">Estimated quota from routing</h2>
        <p>On {routing.date}, the suite classified {routing.turns} representative requests. The policy routed {routing.mix.flash} to flash, {routing.mix.craft} to craft, and {routing.mix.forge} to forge.</p>
        <p>The policy estimated <strong>{routing.saved}% less relative quota</strong> than sending every request to forge ({routing.actual.toFixed(2)} vs. {routing.alwaysForge.toFixed(2)} policy units). {routing.match} of {routing.turns} routing decisions matched the expected lane. {routing.liveTurns} used live Jev{routing.avgJevMs === null ? "." : `, averaging ${routing.avgJevMs} ms.`}</p>
        <p>The estimate uses model and reasoning-effort weights. To reproduce it, set up your TypeSafe API key and run the suite against the current policy.</p>
        <pre className="overflow-x-auto rounded-xl bg-wash p-4">{`npm ci
npm run e2e:report`}</pre>
        <div className="flex flex-wrap gap-4">
          <a className="underline" href={REPORT_URL}>Per-request results and prompts</a>
          <a className="underline" href={POLICY_URL}>Policy and usage weights</a>
          <Link className="underline" href="/guides/en">Reduce Codex CLI token usage</Link>
        </div>
      </section>
      <section className="space-y-4" id="short-questions">
        <h2 className="text-2xl font-semibold">Short Codex CLI questions</h2>
        <p>On {CLI_COMPARISON.date}, we asked {CLI_COMPARISON.tasks} short questions about npm and JavaScript. Each question had an exact expected answer. The manual strategy used a preset lane per question. For the Sift strategy, the runner used the model and effort returned by the router.</p>
        <div className="overflow-x-auto">
          <table className={tableStyles}>
            <thead className="bg-wash"><tr><th scope="col">Strategy</th><th scope="col">Correct</th><th scope="col">Input tokens</th><th scope="col">Cached input</th><th scope="col">Output tokens</th><th scope="col">Total time</th></tr></thead>
            <tbody>
              {CLI_COMPARISON.strategies.map((result) => (
                <tr key={result.id}>
                  <th scope="row">{result.id === "sift" ? "Sift-selected" : labels[result.id]}</th>
                  <td>{result.correct}/{result.count}</td>
                  <td>{observedValue(result.input, result.count)}</td>
                  <td>{observedValue(result.cached, result.count)}</td>
                  <td>{observedValue(result.output, result.count)}</td>
                  <td>{observedValue(result.time, result.count, seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Time includes CLI startup and, for Sift, routing latency. Total input includes cached input. Each strategy ran once in a fixed order. The repository suite above exercises edits and measures proxy overhead as part of total time.</p>
        <p>With a signed-in Codex CLI and a TypeSafe API key, run <code>node tools/compare-models.mjs</code> after <code>npm ci</code>.</p>
        <a className="underline" href={`${REPO_URL}/blob/main/reports/model-comparison.json`}>Raw token counts and scores</a>
      </section>
      <Link className="block underline" href="/compare">Manual model switching vs Codex Sift</Link>
      <InstallActions page="benchmark" />
    </main>
  );
}
