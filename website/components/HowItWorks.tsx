import { NOT_ROUTED, STEPS } from "@/lib/content";
import { TiltCard } from "./TiltCard";

const FLOW = [
  { t: "you", s: "codex-sift" },
  { t: "Codex TUI", s: "model=sift" },
  { t: "Sift proxy", s: "127.0.0.1 · Jev + policy.yaml" },
  { t: "Upstream", s: "chatgpt.com/backend-api/codex or api.openai.com" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">A decision layer before Codex spends the turn</h2>

        <ol aria-label="Request flow" className="mt-12 grid gap-3 md:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.t} className="relative rounded-xl border border-line bg-white px-4 py-3">
              <p className="font-mono text-sm">{f.t}</p>
              <p className="mt-0.5 break-words font-mono text-[11px] leading-snug text-muted">{f.s}</p>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="absolute -bottom-3 left-1/2 z-10 h-3 w-px bg-accent md:-right-3 md:bottom-auto md:left-auto md:top-1/2 md:h-px md:w-3" />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {STEPS.map((s) => (
            <TiltCard key={s.n} className="p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-accent-ink">{s.n}</span>
                <span className="rounded-full bg-tint px-2.5 py-1 font-mono text-[11px] text-accent-ink">{s.tag}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </TiltCard>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-wash p-7">
          <h3 className="text-lg font-semibold tracking-tight">What is not routed</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-2 text-[15px] text-muted sm:grid-cols-2">
            {NOT_ROUTED.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="mt-2.5 h-1 w-3 shrink-0 rounded-full bg-accent" />
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted">
            Sift is Codex-only. It is not an MCP server and does not patch <code className="font-mono text-ink">~/.codex/config.toml</code>. Pin another model in <code className="font-mono text-ink">/model</code> and routing pauses until you pick Sift again.
          </p>
        </div>
      </div>
    </section>
  );
}
