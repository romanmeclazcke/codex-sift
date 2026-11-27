import type { Metadata } from "next";
import Link from "next/link";
import { InstallActions } from "@/components/InstallActions";
import { ArticleJsonLd } from "@/components/JsonLd";
import { CLI_COMPARISON } from "@/lib/benchmark-data";
import { POLICY_URL } from "@/lib/content";

const title = "Manual Codex model switching vs Codex Sift";
const description = "Compare switching models with /model, using one model for a session, and choosing automatically for each Codex CLI turn.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/compare" },
  openGraph: { title, description, url: "/compare", type: "article" },
  twitter: { title, description, card: "summary" },
};

export default function Compare() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-12">
      <ArticleJsonLd path="/compare" title={title} description={description} language="en" />
      <Link href="/">Codex Sift</Link>
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p>Use <code>/model</code> when you want to decide which model handles the next part of a Codex session. Use Codex Sift when you frequently move between questions, small edits, and harder work and want a policy to select the model and reasoning effort for each turn.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm [&_td]:p-3 [&_th]:p-3">
          <thead className="bg-wash"><tr><th scope="col">Approach</th><th scope="col">When it fits</th><th scope="col">What to account for</th></tr></thead>
          <tbody>
            <tr><th scope="row">Keep one model</th><td>A session with similar tasks or a sustained, complex investigation.</td><td>The same model also handles short lookups and follow-ups.</td></tr>
            <tr><th scope="row">Switch manually</th><td>You know when the task changes and want direct control.</td><td>You need to revisit the choice as the session changes.</td></tr>
            <tr><th scope="row">Route with Sift</th><td>One session mixes tasks that need different levels of reasoning.</td><td>Setup needs a TypeSafe API key. Jev classifies a redacted excerpt of the turn and the policy supplies the model and effort.</td></tr>
          </tbody>
        </table>
      </div>
      <h2 className="text-2xl font-semibold">What we measured</h2>
      <p>We ran {CLI_COMPARISON.tasks} short CLI questions with exact answers once per strategy. The table in the benchmark gives scores, elapsed time and reported tokens for the fixed, manual and Sift-selected strategies. The repository task suite measures whether edits pass independent tests.</p>
      <p><Link className="underline" href="/benchmark">Read the methodology and raw measurements</Link> or <a className="underline" href={POLICY_URL}>inspect the default routing policy</a>.</p>
      <h2 className="text-2xl font-semibold">Try it on your workflow</h2>
      <p>With Node.js 20+, Codex CLI, and a TypeSafe key, run setup and launch <code>npx codex-sift</code>. Try a file question and an edit. Check the chosen model with <code>npx codex-sift explain</code>. You can pin a model with <code>/model</code> and select Sift again to resume routing.</p>
      <InstallActions page="compare" />
      <Link className="underline" href="/guides/en">How to reduce token usage in Codex CLI</Link>
    </main>
  );
}
