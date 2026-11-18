"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type TipContent = { title: string; tag?: string; lines: string[] };

export type TooltipHandle = {
  show: (c: TipContent) => void;
  hide: () => void;
  move: (x: number, y: number) => void;
};

/** Pointer-following tooltip. Position is written straight to the DOM; only show/hide re-render. */
export const Tooltip = forwardRef<TooltipHandle>(function Tooltip(_, handle) {
  const el = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<TipContent | null>(null);

  useImperativeHandle(handle, () => ({
    show: setContent,
    hide: () => setContent(null),
    move: (x, y) => {
      const node = el.current;
      if (!node) return;
      const w = node.offsetWidth || 260;
      const left = Math.min(x + 16, window.innerWidth - w - 12);
      const top = Math.min(y + 18, window.innerHeight - node.offsetHeight - 12);
      node.style.transform = `translate3d(${Math.max(8, left)}px, ${Math.max(8, top)}px, 0)`;
    },
  }));

  return (
    <div
      ref={el}
      role="tooltip"
      aria-hidden={!content}
      className={`pointer-events-none fixed left-0 top-0 z-50 w-[260px] rounded-xl border border-accent/40 bg-white p-3.5 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)] transition-opacity duration-150 ${content ? "opacity-100" : "opacity-0"}`}
    >
      {content && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{content.title}</span>
            {content.tag && <span className="font-mono text-[11px] text-accent-ink">{content.tag}</span>}
          </div>
          <ul className="mt-2 space-y-1 text-[13px] leading-snug text-muted">
            {content.lines.map((l) => (
              <li key={l} className="flex gap-2">
                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                {l}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
});
