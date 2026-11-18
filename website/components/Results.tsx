"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { E2E_CASES, E2E_SUMMARY as S, LANES, LANE_ORDER, REPORT_URL, type LaneId } from "@/lib/content";
import { TiltCard } from "./TiltCard";

const LANE_FILL: Record<LaneId, string> = { flash: "#BAE6FD", craft: "#38BDF8", forge: "#0EA5E9" };
const BASE = 1.35;

function Bar({ label, sub, value, max, color, delay }: { label: string; sub: string; value: number; max: number; color: string; delay: number }) {
  const calm = useReducedMotion();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="font-mono text-xs text-muted">{sub}</p>
        </div>
        <p className="font-mono text-2xl tabular-nums">{value.toFixed(2)}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-tint/60">
        <motion.div
          className="h-full origin-left rounded-full"
          style={{ background: color, width: `${(value / max) * 100}%` }}
          initial={calm ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function Results() {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover === null ? null : E2E_CASES[hover];

  return (
    <section id="results" className="relative border-t border-line bg-wash px-5 pb-28 pt-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Results</p>
          <h2 className="mt-3 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">53.7% less quota on twelve prompts</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Live Jev classified twelve representative Codex prompts into flash, craft or forge. Estimated quota fell from 16.2 to 7.5 against an always-forge baseline. The report measures routing cost. Answer quality is out of scope.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <TiltCard className="p-7 sm:p-9">
            <p className="font-mono text-xs uppercase tracking-wider text-muted">Estimated Codex quota, 12 prompts</p>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-7xl font-semibold leading-none tracking-[-0.05em] text-accent-2 sm:text-8xl">{S.saved}%</span>
              <span className="pb-2 text-sm text-muted">saved vs always-forge</span>
            </div>
            <div className="mt-9 space-y-6">
              <Bar label="Always-forge baseline" sub="every turn on gpt-5.6-sol" value={S.baseline} max={S.baseline} color="#CBD5E1" delay={0} />
              <Bar label="Sift routed" sub="flash + craft + forge lanes" value={S.routed} max={S.baseline} color="#38BDF8" delay={0.15} />
            </div>
            <p className="mt-8 border-t border-line pt-5 text-[13px] leading-relaxed text-muted">
              Measured by <code className="font-mono text-ink">npm run e2e:report</code> with live Jev answers. It measures routing and quota efficiency against the baseline. It does not claim answer quality.{" "}
              <a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-4 hover:text-ink">
                Read the full report
              </a>
              .
            </p>
          </TiltCard>

          <div className="grid grid-cols-2 gap-4">
            {[
              ["12 / 12", "turns classified by live Jev", `${S.degraded} degraded`],
              [S.match, "landed on the expected lane", "policy expectation"],
              [`${S.avgJevMs} ms`, "average Jev latency", "in this run"],
              [`${S.mix.flash} · ${S.mix.craft} · ${S.mix.forge}`, "flash · craft · forge", "lane mix"],
            ].map(([big, label, sub]) => (
              <TiltCard key={label} className="p-5">
                <p className="font-mono text-2xl tracking-tight sm:text-3xl">{big}</p>
                <p className="mt-2 text-sm">{label}</p>
                <p className="font-mono text-xs text-muted">{sub}</p>
              </TiltCard>
            ))}
          </div>
        </div>

        <TiltCard className="mt-6 p-6 sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">Lane usage per prompt</h3>
              <p className="mt-1 text-sm text-muted">Gray is the always-forge cost (1.35). Blue is what the routed lane used.</p>
            </div>
            <ul className="flex flex-wrap gap-4 font-mono text-xs text-muted" aria-label="Legend">
              {LANE_ORDER.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LANE_FILL[id] }} />
                  {id} · {LANES[id].model}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 flex h-40 items-end gap-1.5 sm:gap-3" onPointerLeave={() => setHover(null)}>
            {E2E_CASES.map((c, i) => (
              <button
                key={c.id}
                type="button"
                aria-label={`${c.prompt}: routed to ${c.lane}, usage ${c.usage} of ${BASE}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="group relative h-full min-w-0 flex-1 rounded-md"
              >
                <span className="absolute inset-x-0 bottom-0 h-full rounded-md bg-line/70 transition-colors group-hover:bg-line" />
                <motion.span
                  className="absolute inset-x-0 bottom-0 origin-bottom rounded-md"
                  style={{ background: LANE_FILL[c.lane], height: `${(c.usage / BASE) * 100}%` }}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.8, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                />
                {hover === i && <span aria-hidden className="absolute inset-0 rounded-md ring-2 ring-accent-2" />}
              </button>
            ))}
          </div>
          <div className="mt-5 min-h-[3.25rem] rounded-xl bg-wash px-4 py-3 text-sm" aria-live="polite">
            {active ? (
              <>
                <span className="font-mono text-accent-ink">{active.lane}</span> · {active.usage.toFixed(2)} vs {BASE} ({active.saved.toFixed(1)}% saved) —{" "}
                <span className="text-muted">“{active.prompt}”</span>
                {active.lane !== active.expected && <span className="text-muted"> · policy expected {active.expected}</span>}
              </>
            ) : (
              <span className="text-muted">Hover or focus a bar to see the prompt behind it.</span>
            )}
          </div>
        </TiltCard>
      </div>
    </section>
  );
}
