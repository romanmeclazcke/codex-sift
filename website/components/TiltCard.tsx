"use client";

import { useRef } from "react";

/** Card that tilts a few degrees toward the pointer and shows a soft highlight under it. */
export function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 6}deg) translateY(-2px)`;
    el.style.setProperty("--hx", `${px * 100}%`);
    el.style.setProperty("--hy", `${py * 100}%`);
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`group relative overflow-hidden rounded-2xl border border-line bg-white transition-[transform,border-color,box-shadow] duration-200 ease-out hover:border-accent/70 hover:shadow-[0_18px_40px_-24px_rgba(14,165,233,0.45)] ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(240px circle at var(--hx,50%) var(--hy,50%), rgba(224,242,254,0.9), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
