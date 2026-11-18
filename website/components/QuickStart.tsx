"use client";

import { Fragment, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CODEX_URL, JEV_DOCS_URL, NPM_URL, POLICY_URL, README_URL, TABS } from "@/lib/content";

type Tok = { t: string; c?: string };

const CMD = new Set(["git", "cd", "npm", "npx", "codex-sift", "codex"]);

function highlight(line: string): Tok[] {
  if (/^\s*#/.test(line)) return [{ t: line, c: "text-slate-400 italic" }];
  const out: Tok[] = [];
  const re = /("[^"]*")|(--?[a-z][\w-]*(?:=\S+)?)|(\bgpt-[\w.-]+|\bjev-[\w.]+)|(\b(?:flash|craft|forge|low|medium|high)\b)|(\S+|\s+)/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(line))) {
    const [tok, str, flag, model, lane] = m;
    if (str) out.push({ t: tok, c: "text-emerald-700" });
    else if (flag) out.push({ t: tok, c: "text-violet-600" });
    else if (model) out.push({ t: tok, c: "text-accent-ink" });
    else if (lane) out.push({ t: tok, c: "text-amber-700" });
    else if (first && CMD.has(tok)) out.push({ t: tok, c: "text-accent-ink font-medium" });
    else if (/^\w[\w-]*:$/.test(tok)) out.push({ t: tok, c: "text-sky-700" });
    else out.push({ t: tok });
    if (tok.trim()) first = false;
  }
  return out;
}

export function QuickStart() {
  const calm = useReducedMotion();
  const [tab, setTab] = useState(TABS[0].id);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  const copy = async () => {
    const text = current.code
      .split("\n")
      .filter((l) => !/^\s*#/.test(l) || current.id === "policy")
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (next === null) return;
    const t = TABS[(next + TABS.length) % TABS.length];
    setTab(t.id);
    document.getElementById(`tab-${t.id}`)?.focus();
  };

  return (
    <section id="quick-start" className="border-t border-line bg-wash px-5 py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Quick start</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Install, set up, then run Codex through Sift</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">
            Install with <code className="font-mono text-ink">npm install -g codex-sift</code>, run <code className="font-mono text-ink">codex-sift setup</code> to assign models to flash, craft and forge, then start a session. Arguments match <code className="font-mono text-ink">codex</code>.
          </p>
          <ul className="mt-6 space-y-2 text-[15px]">
            {[
              ["npm package: codex-sift", NPM_URL],
              ["Node 20+ and the Codex CLI", CODEX_URL],
              ["A TypeSafe key for live Jev routing", JEV_DOCS_URL],
              ["Full README and configuration table", README_URL],
              ["Default policy.yaml", POLICY_URL],
            ].map(([t, h]) => (
              <li key={t}>
                <a href={h} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-accent-ink underline-offset-4 hover:underline">
                  {t}
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-40px_rgba(14,165,233,0.5)]">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-wash/70 pl-2 pr-3">
            <div role="tablist" aria-label="Setup steps" onKeyDown={onKey} className="flex min-w-0 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  aria-controls="qs-panel"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={`relative min-h-12 px-4 font-mono text-[13px] transition-colors ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  {t.label}
                  {tab === t.id && <motion.span layoutId="qs-underline" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 font-mono text-xs transition-colors hover:border-accent"
            >
              {copied ? "Copied" : "Copy"}
              <span className="sr-only" aria-live="polite">
                {copied ? "Commands copied to clipboard" : ""}
              </span>
            </button>
          </div>
          <div id="qs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
            <p className="border-b border-line/70 px-5 py-3 text-[13px] text-muted">{current.note}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre
                key={current.id}
                initial={calm ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={calm ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-7"
              >
                <code>
                  {current.code.split("\n").map((line, i) => (
                    <Fragment key={i}>
                      <span className="block min-h-7 whitespace-pre">
                        {highlight(line).map((tk, j) => (
                          <span key={j} className={tk.c}>
                            {tk.t}
                          </span>
                        ))}
                      </span>
                    </Fragment>
                  ))}
                </code>
              </motion.pre>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
