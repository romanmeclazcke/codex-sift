import type { Metadata } from "next";
import Link from "next/link";
import { InstallActions } from "@/components/InstallActions";
import { POLICY_URL, REPORT_URL } from "@/lib/content";

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
      <InstallActions page="benchmark" />
    </main>
  );
}
