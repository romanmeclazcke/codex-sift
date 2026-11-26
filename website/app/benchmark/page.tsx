import type { Metadata } from "next";
import Link from "next/link";
import { InstallActions } from "@/components/InstallActions";
import { POLICY_URL, REPORT_URL, REPO_URL } from "@/lib/content";

const title = "Codex CLI model routing benchmark";
const description = "See how Codex Sift routed 12 representative requests and reproduce the estimated quota comparison.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/benchmark" },
  openGraph: { title, description, url: "/benchmark" },
  twitter: { card: "summary", title, description },
};

export default function Benchmark() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-12">
      <Link href="/">Codex Sift</Link>
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p>On November 26, 2026, Codex Sift classified 12 representative requests with TypeSafe Jev. The YAML policy sent four to flash, four to craft, and four to forge.</p>
      <p>The policy estimated <strong>48.8% less relative quota</strong> than sending every request to forge (8.30 vs. 16.20 policy units). Jev averaged 249 ms and 12 of 12 routing decisions matched the expected lane.</p>
      <p>The calculation uses model and reasoning-effort weights in the policy. Actual tokens, bills, implementation time and answer quality require executing the tasks and scoring their results.</p>
      <h2 className="text-2xl font-semibold">Reproduce the routing test</h2>
      <p>Clone the repository and set up your TypeSafe API key. Run the suite on the current policy and record the model IDs and date when comparing reports.</p>
      <pre className="overflow-x-auto rounded-xl bg-wash p-4">{`npm ci
npm run e2e:report`}</pre>
      <div className="flex flex-wrap gap-4">
        <a className="underline" href={REPORT_URL}>Per-request results and prompts</a>
        <a className="underline" href={POLICY_URL}>Policy and usage weights</a>
        <Link className="underline" href="/guides/en">Reduce Codex CLI token usage</Link>
      </div>
      <h2 className="text-2xl font-semibold">Three live Codex CLI tasks</h2>
      <p>In a separate November 26 run, we asked Codex to identify an npm script, evaluate a JavaScript expression, and predict microtask ordering. Each answer had an exact expected result. The manual strategy used one lane per task in order of difficulty. The Sift strategy used the model and effort selected by the router for each prompt.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm [&_td]:p-2 [&_th]:p-2">
          <thead className="bg-wash"><tr><th scope="col">Strategy</th><th scope="col">Correct</th><th scope="col">Input tokens</th><th scope="col">Cached input</th><th scope="col">Output tokens</th><th scope="col">Total time</th></tr></thead>
          <tbody>
            <tr><th scope="row">Always forge</th><td>3/3</td><td>59,654</td><td>34,176</td><td>18</td><td>16.0 s</td></tr>
            <tr><th scope="row">Manual</th><td>3/3</td><td>57,922</td><td>36,736</td><td>89</td><td>16.3 s</td></tr>
            <tr><th scope="row">Sift-selected</th><td>3/3</td><td>54,458</td><td>30,336</td><td>119</td><td>17.7 s</td></tr>
          </tbody>
        </table>
      </div>
      <p>Time includes CLI startup and, for Sift, measured routing latency. Cached input is included in total input. These three short tasks had one run per strategy in a fixed order. The results cover exact answers on these tasks. Repository edits, full proxy overhead and monetary cost would require a separate benchmark.</p>
      <p>With a signed-in Codex CLI and a TypeSafe API key, run <code>node tools/compare-models.mjs</code> after <code>npm ci</code>.</p>
      <a className="underline" href={`${REPO_URL}/blob/main/reports/model-comparison.json`}>Raw token counts and scores</a>
      <InstallActions page="benchmark" />
    </main>
  );
}
