"use client";

import { motion, useReducedMotion } from "motion/react";
import { AUTHOR, CONTRIBUTING_URL, LICENSE_URL, README_URL, REPO_URL, REPORT_URL } from "@/lib/content";
import { GitHubMark, MagneticButton } from "./Buttons";

export function FinalCta() {
  const calm = useReducedMotion();
  return (
    <>
      <section className="relative overflow-hidden border-t border-line px-5 pb-24 pt-20 text-center">
        <svg aria-hidden viewBox="0 0 600 200" className="mx-auto block h-36 w-full max-w-[600px] overflow-visible">
          <path d="M 300 0 L 300 70 C 300 110, 480 100, 480 150" fill="none" stroke="#E2E8F0" strokeWidth="2" />
          <motion.path
            d="M 300 0 L 300 70 C 300 110, 480 100, 480 150"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3"
            strokeLinecap="round"
            initial={calm ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.circle
            cx="480"
            cy="156"
            r="7"
            fill="#38BDF8"
            stroke="#fff"
            strokeWidth="3"
            initial={calm ? false : { opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ delay: 1.5, duration: 0.4 }}
          />
        </svg>
        <p className="eyebrow mt-8">Next step</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">Install Sift and keep the Codex TUI</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Stop spending your strongest model on “explain this file”. Add the decision layer in front of Codex, then check the difference with <code className="font-mono text-ink">codex-sift report</code>. Built by{" "}
          <a href={AUTHOR.url} target="_blank" rel="author noopener noreferrer" className="text-ink underline underline-offset-4 hover:text-accent-ink">
            {AUTHOR.name}
          </a>
          .
        </p>
        <p className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
          <a href={AUTHOR.x} target="_blank" rel="me noopener noreferrer" className="transition-colors hover:text-ink">
            X · @{AUTHOR.xHandle}
          </a>
          <a href={AUTHOR.linkedin} target="_blank" rel="me noopener noreferrer" className="transition-colors hover:text-ink">
            LinkedIn
          </a>
          <a href={AUTHOR.url} target="_blank" rel="me noopener noreferrer" className="transition-colors hover:text-ink">
            GitHub
          </a>
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <MagneticButton href="#quick-start">Install Codex Sift</MagneticButton>
          <MagneticButton href={REPO_URL} variant="secondary" external>
            <GitHubMark /> View on GitHub
          </MagneticButton>
        </div>
        <a href="#top" className="mt-14 inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-mono text-xs text-muted transition-colors hover:text-ink">
          ↑ Back to the request path
        </a>
      </section>
      <footer className="border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <p>
            Codex Sift · MIT · Built by{" "}
            <a href={AUTHOR.url} rel="author noopener noreferrer" target="_blank" className="text-ink transition-colors hover:text-accent-ink">
              {AUTHOR.name}
            </a>
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              ["X", AUTHOR.x],
              ["LinkedIn", AUTHOR.linkedin],
              ["README", README_URL],
              ["E2E report", REPORT_URL],
              ["Contributing", CONTRIBUTING_URL],
              ["License", LICENSE_URL],
              ["GitHub", REPO_URL],
            ].map(([t, h]) => (
              <li key={t}>
                <a href={h} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink">
                  {t}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
