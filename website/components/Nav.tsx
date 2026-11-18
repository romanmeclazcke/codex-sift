import { GitHubMark } from "./Buttons";
import { README_URL, REPO_URL } from "@/lib/content";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#results", label: "Results" },
  { href: "#quick-start", label: "Quick start" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-sm">
      <nav aria-label="Primary" className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="relative block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_4px_#E0F2FE]" />
          Codex Sift
        </a>
        <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a href={README_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink">
              Docs
            </a>
          </li>
        </ul>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 text-sm transition-colors hover:border-accent hover:bg-wash"
        >
          <GitHubMark /> GitHub
        </a>
      </nav>
    </header>
  );
}
