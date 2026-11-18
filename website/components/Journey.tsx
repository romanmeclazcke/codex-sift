"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { LANES, LANE_ORDER, SIGNALS, REPO_SLUG, REPO_URL, type LaneId } from "@/lib/content";
import {
  SPINE_START,
  branchD,
  connectorD,
  makeGeo,
  requestD,
  returnD,
  stations,
  type Geo,
  type Mode,
} from "@/lib/geometry";
import { useReducedMotion } from "@/lib/hooks";
import { GitHubMark, MagneticButton } from "./Buttons";
import { Tooltip, type TipContent, type TooltipHandle } from "./Tooltip";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function mapKeys(p: number, keys: [number, number][]): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return lerp(v0, v1, (p - p0) / (p1 - p0));
    }
  }
  return keys[keys.length - 1][1];
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const CHAPTERS = [
  {
    range: [0.07, 0.3],
    eyebrow: "Request",
    title: "Every turn hits Sift first",
    body: "Codex has no hook that changes the model before a turn is billed. It does accept a custom model_provider. Sift runs a loopback Responses proxy on 127.0.0.1 and sees the turn before Codex spends it.",
  },
  {
    range: [0.3, 0.47],
    eyebrow: "Router",
    title: "Jev answers six typed signals",
    body: "Sift asks TypeSafe Jev how hard the task is. Jev returns task_kind, difficulty and four other signals in about 300 ms. It never writes code or picks a model.",
  },
  {
    range: [0.47, 0.69],
    eyebrow: "Policy",
    title: "policy.yaml picks the lane",
    body: "Your rules map those signals to flash, craft or forge. First match wins. Hover a branch to read its rules, or tap one to route a different request.",
  },
  {
    range: [0.69, 0.8],
    eyebrow: "Model",
    title: "Codex runs on that lane",
    body: "Only model and reasoning.effort are rewritten. The rest of the Responses body stays intact, and your existing login is forwarded upstream.",
  },
  {
    range: [0.8, 1.2],
    eyebrow: "Response",
    title: "The reply returns to the Codex TUI",
    body: "Tool-loop continuations stay pinned to the same lane, so one turn never changes model midway. Sessions, tools and sandbox stay what Codex ships.",
  },
] as const;

const P_PROCESS = 0.7;
const P_RESP0 = 0.8;
const P_RESP1 = 0.95;

type Metrics = { vw: number; vh: number; s: number; y0: number; anchor: number; camX: number };

export function Journey() {
  const reduced = useReducedMotion();
  const [sample, setSample] = useState({ lane: "flash" as LaneId, index: 0 });
  const { lane, index } = sample;
  const example = LANES[lane].examples[index];
  const [mode, setMode] = useState<Mode>(880);
  const [ready, setReady] = useState(false);

  const geo = useMemo(() => makeGeo(mode), [mode]);
  const container = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, Element | null>>({});
  const reg = (k: string) => (n: Element | null) => {
    els.current[k] = n;
  };
  const tip = useRef<TooltipHandle>(null);
  const pRef = useRef(0);
  const intro = useRef(0);
  const lens = useRef({ req: 3000, resp: 600 });
  const mt = useRef<Metrics>({ vw: 0, vh: 0, s: 1, y0: 0, anchor: 0.4, camX: 0.5 });
  const cache = useRef<Record<string, string>>({});
  const updateRef = useRef<() => void>(() => {});

  const setText = (key: string, value: string) => {
    if (cache.current[key] === value) return;
    cache.current[key] = value;
    const n = els.current[key];
    if (n) n.textContent = value;
  };
  const setData = (key: string, name: string, value: string) => {
    const n = els.current[key] as HTMLElement | SVGElement | null | undefined;
    if (n && n.dataset[name] !== value) n.dataset[name] = value;
  };
  const setAttr = (key: string, name: string, value: string | number) => {
    els.current[key]?.setAttribute(name, String(value));
  };

  const update = useCallback(() => {
    const m = mt.current;
    const e = els.current;
    const req = e.req as SVGPathElement | null;
    const resp = e.resp as SVGPathElement | null;
    const world = e.world as HTMLElement | null;
    if (!m.vw || !req || !resp || !world) return;

    const p = pRef.current;
    const g = geo;
    const st = stations(g, lane);
    const L = lens.current;
    const scale = L.req / st.total;

    const dist = mapKeys(p, [
      [0.06, 0],
      [0.3, st.dRouterTop],
      [0.45, st.dRouterBot],
      [0.49, st.dBranch],
      [0.6, st.dLane],
      [0.69, st.dModel],
    ]);
    const litDist = Math.max(dist, intro.current * 150);
    const rp = clamp((p - P_RESP0) / (P_RESP1 - P_RESP0));
    const responding = p >= P_RESP0;

    // lit trails
    setAttr("req", "stroke-dashoffset", L.req - litDist * scale);
    setAttr("resp", "stroke-dashoffset", L.resp - rp * L.resp);
    setAttr("tail", "opacity", clamp((p - 0.93) / 0.05));

    // particle
    const pt = responding ? resp.getPointAtLength(rp * L.resp) : req.getPointAtLength(dist * scale);
    const fadeIn = clamp(dist / 50);
    const intoCard = 1 - clamp((p - 0.67) / 0.03);
    const outOfCard = clamp((p - P_RESP0) / 0.02);
    const throughRouter = responding
      ? 0
      : clamp((dist - st.dRouterTop) / 18) * (1 - clamp((dist - (st.dRouterBot - 18)) / 18));
    // Fade the particle around the lane badge and its subtitle.
    const aboveLane = 1 - clamp((pt.y - (g.laneY - 55)) / 20);
    const belowLane = clamp((pt.y - (g.laneY + 62)) / 18);
    const po = responding ? outOfCard : fadeIn * intoCard * (1 - throughRouter) * Math.max(aboveLane, belowLane);
    setAttr("particle", "transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
    setAttr("particle", "opacity", po.toFixed(3));
    const phase = responding ? "resp" : "req";
    if (cache.current.phase !== phase) {
      cache.current.phase = phase;
      setAttr("core", "fill", phase === "req" ? "#38BDF8" : "#FFFFFF");
      setAttr("core", "stroke", phase === "req" ? "#FFFFFF" : "#0EA5E9");
    }
    setAttr("pill", "opacity", (1 - 0.8 * clamp(dist / 120)).toFixed(3));
    setAttr("ambient", "opacity", (1 - clamp(dist / 220)).toFixed(3));

    // stage labels
    g.labelYs.forEach((y, i) => {
      const t = clamp((dist - (y - SPINE_START) + 50) / 70);
      setAttr(`label${i}`, "opacity", t.toFixed(3));
      setAttr(`label${i}`, "transform", `translate(0 ${((1 - t) * 12).toFixed(2)})`);
    });

    // router
    const rt = clamp((dist - st.dRouterTop) / (st.dRouterBot - st.dRouterTop));
    SIGNALS.forEach((_, i) => setData(`sig${i}`, "on", rt > (i + 0.4) / SIGNALS.length ? "1" : "0"));
    const rs = rt > 0 && rt < 1 ? "scan" : rt >= 1 ? "done" : "idle";
    setData("router", "state", rs);
    setData("rc", "state", rs);
    setAttr("rbar", "width", (rt * (g.router.w - 44)).toFixed(2));
    const L0 = LANES[lane];
    setText(
      "rstatus",
      dist >= st.dBranch - 5
        ? `${lane} · ${L0.model}`
        : rt >= 1
          ? "applying policy.yaml"
          : rt > 0
            ? "reading signals…"
            : "awaiting request",
    );

    // branches
    const u1 = clamp((dist - st.dRouterBot + 60) / (st.dBranch - st.dRouterBot + 110));
    const u2 = clamp((dist - st.dBranch) / (st.dLane - st.dBranch + 40));
    const decided = dist >= st.dBranch - 5;
    for (const id of LANE_ORDER) {
      setAttr(`b-${id}`, "stroke-dashoffset", (1 - u1).toFixed(4));
      setAttr(`c-${id}`, "stroke-dashoffset", (1 - u2).toFixed(4));
      setAttr(`r-${id}`, "stroke-dashoffset", (1 - u2).toFixed(4));
      setAttr(`pillwrap-${id}`, "opacity", u1.toFixed(3));
      setAttr(`cardwrap-${id}`, "opacity", u2.toFixed(3));
      const sel = decided ? (id === lane ? "1" : "0") : "n";
      setData(`lane-${id}`, "sel", sel);
      setData(`card-${id}`, "sel", sel);
      const mine = id === lane;
      const state = !mine
        ? "idle"
        : rp >= 1
          ? "done"
          : responding
            ? "responding"
            : p >= P_PROCESS
              ? "processing"
              : dist >= st.dModel - 1
                ? "active"
                : "idle";
      setData(`card-${id}`, "state", state);
      setText(
        `cs-${id}`,
        { idle: "standby", active: "request received", processing: "running turn…", responding: "streaming response", done: "response delivered" }[
          state
        ] ?? "standby",
      );
      setAttr(`cb-${id}`, "width", (mine ? rp * (g.cardW - 32) : 0).toFixed(2));
    }
    setAttr("tuiwrap", "opacity", u2.toFixed(3));
    setData("tui", "on", rp >= 1 ? "1" : "0");

    // camera
    const reqY = req.getPointAtLength(dist * scale).y;
    let camY: number;
    if (p < P_PROCESS) camY = reqY - 20;
    else if (!responding) camY = lerp(g.card.y - 20, g.card.y + g.card.h - 20, ease((p - P_PROCESS) / (P_RESP0 - P_PROCESS)));
    else camY = pt.y - 20;
    camY = Math.max(camY, 100);
    const anchor = lerp(m.y0, m.anchor * m.vh, ease(clamp((p - 0.04) / 0.1)));
    let camXf = lerp(0.5, m.camX, ease(clamp((p - 0.07) / 0.13)));
    camXf = lerp(camXf, 0.5, ease(clamp((p - 0.93) / 0.07)));
    const left = camXf * m.vw - g.cx * m.s;
    const top = anchor - camY * m.s;
    world.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
    // Crossfade the mobile hero and diagram over the same scroll interval.
    const heroFade = clamp(p / 0.045);
    const worldO = !ready ? 0 : m.vw < 1024 ? heroFade : 1;
    world.style.opacity = worldO.toFixed(3);

    // hero + captions + chips
    const h = e.hero as HTMLElement | null;
    if (h) {
      const o = 1 - heroFade;
      h.style.opacity = o.toFixed(3);
      h.style.transform = `translate3d(0, ${(-clamp(p / 0.06) * 36).toFixed(1)}px, 0)`;
      h.style.visibility = o <= 0 ? "hidden" : "visible";
    }
    CHAPTERS.forEach((c, i) => {
      const n = e[`cap${i}`] as HTMLElement | null;
      if (!n) return;
      const fade = 0.022;
      const a = clamp((p - c.range[0]) / fade);
      const b = i === CHAPTERS.length - 1 ? 1 : clamp((c.range[1] - p) / fade);
      const o = Math.min(a, b);
      n.style.opacity = o.toFixed(3);
      n.style.transform = `translate3d(0, ${((1 - a) * 18 - (1 - b) * 18).toFixed(1)}px, 0)`;
      n.style.visibility = o <= 0.001 ? "hidden" : "visible";
    });
    const chips = e.chips as HTMLElement | null;
    if (chips) {
      const o = clamp((p - 0.05) / 0.04);
      chips.style.opacity = o.toFixed(3);
      chips.style.visibility = o <= 0 ? "hidden" : "visible";
    }
    const prog = e.progress as HTMLElement | null;
    if (prog) prog.style.transform = `scaleY(${clamp((p - 0.06) / 0.89).toFixed(4)})`;
  }, [geo, lane, ready]);

  updateRef.current = update;

  const measure = useCallback(() => {
    const stage = els.current.stage as HTMLElement | null;
    const world = els.current.world as HTMLElement | null;
    if (!stage || !world) return;
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;
    const nm: Mode = vw >= 1024 ? 880 : vw >= 640 ? 700 : 600;
    const s =
      nm === 880
        ? Math.min(1.2, (vw * 0.62) / 880)
        : nm === 700
          ? Math.min(1.15, (vw * 0.92) / nm)
          : Math.min(1.05, (vw * 0.9) / nm);
    const heroInner = els.current.heroInner as HTMLElement | null;
    const heroBottom = heroInner ? heroInner.offsetTop + heroInner.offsetHeight : vh * 0.5;
    // Phone/tablet: park the diagram in the upper band above the bottom sheet until scroll takes over.
    const y0 =
      nm === 880
        ? clamp(heroBottom + 96, vh * 0.6, vh - 120)
        : clamp(vh * 0.42, 180, Math.max(200, vh - 320));
    mt.current = {
      vw,
      vh,
      s,
      y0,
      anchor: nm === 880 ? 0.42 : nm === 700 ? 0.34 : 0.32,
      camX: nm === 880 ? 0.63 : 0.5,
    };
    world.style.width = `${nm * s}px`;
    world.style.height = `${2500 * s}px`;
    setMode((cur) => (cur === nm ? cur : nm));
  }, []);

  const { scrollYProgress } = useScroll({ target: container, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    pRef.current = v;
    updateRef.current();
  });

  useLayoutEffect(() => {
    measure();
    const stage = els.current.stage;
    if (!stage) return;
    const ro = new ResizeObserver(() => {
      measure();
      updateRef.current();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    const req = els.current.req as SVGPathElement | null;
    const resp = els.current.resp as SVGPathElement | null;
    if (!req || !resp) return;
    lens.current = { req: req.getTotalLength(), resp: resp.getTotalLength() };
    setAttr("req", "stroke-dasharray", lens.current.req);
    setAttr("resp", "stroke-dasharray", lens.current.resp);
    pRef.current = scrollYProgress.get();
    update();
    setReady(true);
  }, [geo, lane, update, scrollYProgress]);

  useEffect(() => {
    if (reduced) {
      intro.current = 1;
      updateRef.current();
      return;
    }
    let raf = 0;
    const t0 = performance.now() + 350;
    const tick = (now: number) => {
      intro.current = ease(clamp((now - t0) / 1300));
      updateRef.current();
      if (intro.current < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const grid = els.current.grid as HTMLElement | null;
    if (grid) {
      grid.style.setProperty("--mx", `${ev.clientX}px`);
      grid.style.setProperty("--my", `${ev.clientY}px`);
    }
    tip.current?.move(ev.clientX, ev.clientY);
  };

  const laneTip = (id: LaneId): TipContent => ({
    title: `Lane · ${id}`,
    tag: `${LANES[id].model} · ${LANES[id].effort}`,
    lines: [LANES[id].use, ...LANES[id].rules.map((r) => `rule: ${r}`), id === lane ? "Currently routed" : "Click to route a different request here"],
  });
  const routerTip: TipContent = {
    title: "Smart router",
    tag: "jev-1.13.0",
    lines: [
      "Jev answers atomic questions: " + SIGNALS.join(", "),
      "The policy never asks Jev “which model?”",
      "If Jev is down, Sift fails open to craft and marks the turn degraded",
    ],
  };

  const setLane = (next: LaneId) => setSample((current) => current.lane === next ? current : { lane: next, index: 0 });

  const routeRandomExample = () => {
    const otherLanes = LANE_ORDER.filter((id) => id !== lane);
    const next = otherLanes[Math.floor(Math.random() * otherLanes.length)];
    const examples = LANES[next].examples;
    setSample({ lane: next, index: Math.floor(Math.random() * examples.length) });

    const journey = container.current;
    const stage = els.current.stage;
    if (journey && stage) {
      const start = window.scrollY + journey.getBoundingClientRect().top;
      const distance = journey.offsetHeight - stage.clientHeight;
      window.scrollTo({ top: start + distance * 0.1, behavior: reduced ? "instant" : "smooth" });
    }
  };

  const fs = geo.fs;
  const promptLines = useMemo(
    () => wrap(`“${example}”`, Math.floor((geo.W - (geo.cx + 18) - 12) / (fs.xs * 0.6))),
    [example, geo.W, geo.cx, fs.xs],
  );
  const R = geo.router;
  const cellFs = fs.xs - 2;

  return (
    <div id="top" ref={container} className="relative h-[760vh] lg:h-[820vh]">
      <div
        ref={reg("stage")}
        onPointerMove={onPointerMove}
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-white"
      >
        <div ref={reg("grid")} aria-hidden className="dotgrid pointer-events-none absolute inset-0" />

        <div
          ref={reg("world")}
          className="world absolute left-0 top-0 will-change-transform lg:transition-opacity lg:duration-500"
          style={{ opacity: 0 }}
        >
          <svg
            viewBox={`0 0 ${geo.W} ${geo.H}`}
            width="100%"
            height="100%"
            role="img"
            aria-label="Diagram: a request enters Codex Sift, the router inspects it, and the policy sends it down the flash, craft or forge lane to a model. The response returns to the Codex TUI."
            className="block overflow-visible"
          >
            {/* ambient requests arriving from elsewhere */}
            {!reduced && (
              <g ref={reg("ambient")} aria-hidden>
                {[
                  { d: `M -140 70 C ${geo.cx * 0.35} 60, ${geo.cx * 0.55} 100, ${geo.cx - 106} 100`, t: 6, b: 0 },
                  { d: `M -140 190 C ${geo.cx * 0.3} 190, ${geo.cx * 0.6} 100, ${geo.cx - 106} 100`, t: 7.5, b: 2 },
                  { d: `M ${geo.W + 140} 80 C ${geo.W - geo.cx * 0.35} 60, ${geo.W - geo.cx * 0.55} 100, ${geo.cx + 106} 100`, t: 6.5, b: 1 },
                  { d: `M ${geo.W + 140} 200 C ${geo.W - geo.cx * 0.3} 200, ${geo.W - geo.cx * 0.6} 100, ${geo.cx + 106} 100`, t: 8, b: 3 },
                ].map((a, i) => (
                  <g key={i}>
                    <path d={a.d} fill="none" stroke="#EEF2F7" strokeWidth="1.5" strokeDasharray="3 7" />
                    <circle r="3" fill="#CBD5E1">
                      <animateMotion dur={`${a.t}s`} begin={`${a.b}s`} repeatCount="indefinite" path={a.d} />
                    </circle>
                  </g>
                ))}
              </g>
            )}

            {/* base tracks */}
            <path d={`M ${geo.cx} ${SPINE_START} L ${geo.cx} ${geo.branchY}`} stroke="#E2E8F0" strokeWidth="2" fill="none" />
            {LANE_ORDER.map((id) => (
              <g key={id} className="branch" onPointerEnter={() => tip.current?.show(laneTip(id))} onPointerLeave={() => tip.current?.hide()} onClick={() => setLane(id)}>
                <path className="base" d={branchD(geo, id)} fill="none" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" ref={reg(`b-${id}`)} />
                <path className="hit" d={branchD(geo, id)} strokeWidth="34" />
                <path className="base" d={connectorD(geo, id)} fill="none" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" ref={reg(`c-${id}`)} />
                <path className="base" d={returnD(geo, id)} fill="none" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="1" ref={reg(`r-${id}`)} />
              </g>
            ))}

            {/* lit trails */}
            <path ref={reg("req")} d={requestD(geo, lane)} fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="3000" strokeDashoffset="3000" />
            <path ref={reg("resp")} d={returnD(geo, lane)} fill="none" stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round" strokeDasharray="600" strokeDashoffset="600" />
            <path ref={reg("tail")} d={`M ${geo.cx} ${geo.tui.y + 66} L ${geo.cx} ${geo.H}`} fill="none" stroke="#38BDF8" strokeWidth="3" opacity="0" />

            {/* origin node */}
            <g ref={reg("pill")}>
              <circle cx={geo.cx} cy={geo.pillY} r="34" fill="#38BDF8" opacity="0.12" className="pulse-dot" />
              <rect x={geo.cx - 106} y={geo.pillY - 21} width="212" height="42" rx="21" fill="#fff" stroke="#38BDF8" strokeWidth="1.5" />
              <circle cx={geo.cx - 80} cy={geo.pillY} r="4.5" fill="#38BDF8" />
              <text x={geo.cx - 66} y={geo.pillY + 5} fontSize={fs.sm} fill="#0F172A">
                Incoming Request
              </text>
              <text fontSize={fs.xs} fill="#64748B">
                {promptLines.map((l, i) => (
                  <tspan key={l} x={geo.cx + 20} y={geo.pillY + 62 + i * (fs.xs + 7)}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>

            {/* stage labels */}
            {[
              ["Incoming request", "POST /responses · model=sift"],
              ["Inspecting request", "Jev returns typed signals, not code"],
              ["Evaluating routing strategy", "policy.yaml · first match wins"],
            ].map(([t, sub], i) => (
              <g key={t} ref={reg(`label${i}`)} opacity="0">
                <circle cx={geo.cx} cy={geo.labelYs[i]} r="5" fill="#fff" stroke="#38BDF8" strokeWidth="2" />
                <text x={geo.cx + 22} y={geo.labelYs[i] + 4} fontSize={fs.sm} fill="#0F172A">
                  {t}
                </text>
                <text x={geo.cx + 22} y={geo.labelYs[i] + 4 + fs.xs + 8} fontSize={fs.xs} fill="#64748B">
                  {sub}
                </text>
              </g>
            ))}

            {/* router face over the spine so the line enters and leaves without cutting through */}
            <g ref={reg("router")} className="router" data-state="idle" onPointerEnter={() => tip.current?.show(routerTip)} onPointerLeave={() => tip.current?.hide()}>
              <rect className="frame" x={R.x} y={R.y} width={R.w} height={R.h} rx={18} />
              <rect x={R.x + 6} y={R.y + 6} width={R.w - 12} height={R.h - 12} rx={13} fill="none" stroke="#E0F2FE" />
            </g>
            <g className="rc" data-state="idle" ref={reg("rc")} pointerEvents="none">
              <clipPath id="router-clip">
                <rect x={R.x + 2} y={R.y + 2} width={R.w - 4} height={R.h - 4} rx={16} />
              </clipPath>
              <g clipPath="url(#router-clip)">
                <g className="scan" style={{ ["--scan-h" as string]: `${R.h - 16}px` }}>
                  <rect x={R.x + 8} y={R.y + 7} width={R.w - 16} height="2" rx="1" fill="#38BDF8" opacity="0.55" />
                </g>
              </g>
              <text x={R.x + 22} y={R.y + 38} className="sans" fontSize={fs.md} fontWeight="650" letterSpacing="2.2" fill="#0F172A">
                CODEX SIFT
              </text>
              <text x={R.x + 22} y={R.y + 60} fontSize={fs.xs} fill="#64748B">
                Smart router
              </text>
              <text x={R.x + R.w - 22} y={R.y + 38} fontSize={fs.xs} fill="#0369A1" textAnchor="end">
                jev-1.13.0
              </text>
              {SIGNALS.map((name, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const x = col === 0 ? R.x + 24 : geo.cx + 28;
                const y = R.y + 104 + row * 34;
                return (
                  <g key={name} className="sig" data-on="0" ref={reg(`sig${i}`)}>
                    <circle className="dot" cx={x + 5} cy={y - 4} r="4.5" />
                    <text className="txt" x={x + 18} y={y} fontSize={cellFs}>
                      {name}
                    </text>
                  </g>
                );
              })}
              <line x1={R.x + 22} x2={R.x + R.w - 22} y1={R.y + 198} y2={R.y + 198} stroke="#E2E8F0" />
              <rect x={R.x + 22} y={R.y + 212} width={R.w - 44} height="3" rx="1.5" fill="#E0F2FE" />
              <rect ref={reg("rbar")} x={R.x + 22} y={R.y + 212} width="0" height="3" rx="1.5" fill="#38BDF8" />
              <text ref={reg("rstatus")} x={R.x + 22} y={R.y + 245} fontSize={fs.xs} fill="#0F172A">
                awaiting request
              </text>
              <text x={R.x + R.w - 22} y={R.y + 245} fontSize={fs.xs} fill="#64748B" textAnchor="end">
                ≈300 ms
              </text>
            </g>

            {/* lanes */}
            {LANE_ORDER.map((id) => {
              const x = geo.laneX[id];
              const info = LANES[id];
              const cx0 = x - geo.cardW / 2;
              return (
                <g key={id}>
                  <g ref={reg(`pillwrap-${id}`)} opacity="0">
                    <g className="lane" data-sel="n" ref={reg(`lane-${id}`)}>
                      <g className="pill">
                        <rect className="pf" x={x - 50} y={geo.laneY - 17} width="100" height="34" rx="17" strokeWidth="1.5" />
                        <text x={x} y={geo.laneY + 5} textAnchor="middle" fontSize={fs.sm} fontWeight="600" fill="#0F172A">
                          {id}
                        </text>
                      </g>
                      <text x={x} y={geo.laneY + 42} textAnchor="middle" fontSize={fs.xs} fill="#64748B">
                        {info.short}
                      </text>
                    </g>
                  </g>
                  <g ref={reg(`cardwrap-${id}`)} opacity="0">
                    <g
                      className="card lane"
                      data-sel="n"
                      data-state="idle"
                      ref={reg(`card-${id}`)}
                      onPointerEnter={() => tip.current?.show(laneTip(id))}
                      onPointerLeave={() => tip.current?.hide()}
                      onClick={() => setLane(id)}
                    >
                      <rect className="frame" x={cx0} y={geo.card.y} width={geo.cardW} height={geo.card.h} rx="16" />
                      <text x={cx0 + 16} y={geo.card.y + 30} fontSize={fs.xs} fill="#0369A1" letterSpacing="1.2">
                        {id.toUpperCase()}
                      </text>
                      <text x={cx0 + 16} y={geo.card.y + 60} fontSize={fs.model} fontWeight="600" fill="#0F172A">
                        {info.model}
                      </text>
                      <text x={cx0 + 16} y={geo.card.y + 86} fontSize={fs.sm - 1} fill="#64748B">
                        effort {info.effort}
                      </text>
                      <text x={cx0 + 16} y={geo.card.y + 106} fontSize={fs.xs - 1} fill="#64748B">
                        usage {info.usage.toFixed(2)}/1.35
                      </text>
                      <g className="dots">
                        <circle cx={cx0 + 20} cy={geo.card.y + 136} r="3.2" />
                        <circle cx={cx0 + 32} cy={geo.card.y + 136} r="3.2" />
                        <circle cx={cx0 + 44} cy={geo.card.y + 136} r="3.2" />
                      </g>
                      <text ref={reg(`cs-${id}`)} x={cx0 + 56} y={geo.card.y + 140} fontSize={fs.xs - 1} fill="#0F172A">
                        standby
                      </text>
                      <rect x={cx0 + 16} y={geo.card.y + 162} width={geo.cardW - 32} height="4" rx="2" fill="#E0F2FE" />
                      <rect ref={reg(`cb-${id}`)} x={cx0 + 16} y={geo.card.y + 162} width="0" height="4" rx="2" fill="#0EA5E9" />
                    </g>
                  </g>
                </g>
              );
            })}

            {/* destination */}
            <g ref={reg("tuiwrap")} opacity="0">
              <g className="pill" data-on="0" ref={reg("tui")}>
                <rect className="pf" x={geo.cx - 126} y={geo.tui.y - 20} width="252" height="40" rx="20" strokeWidth="1.5" />
                <text x={geo.cx} y={geo.tui.y + 5} textAnchor="middle" fontSize={fs.sm} fill="#0F172A">
                  Codex TUI · response
                </text>
              </g>
              <text x={geo.cx} y={geo.tui.y + 52} textAnchor="middle" fontSize={fs.xs} fill="#64748B">
                sessions, tools, sandbox stay native
              </text>
            </g>

            {/* request particle */}
            <g ref={reg("particle")} opacity="0" pointerEvents="none">
              <circle r="18" fill="#38BDF8" opacity="0.18" />
              {!reduced && <circle r="7" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="particle-ring" />}
              <circle ref={reg("core")} r="7" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="3" />
            </g>
          </svg>
        </div>

        {/* progress rail */}
        <div aria-hidden className="absolute right-3 top-1/2 hidden h-40 w-px -translate-y-1/2 bg-line sm:block lg:right-6">
          <div ref={reg("progress")} className="h-full origin-top bg-accent" style={{ transform: "scaleY(0)" }} />
        </div>

        {/* hero */}
        <div ref={reg("hero")} className="pointer-events-none absolute inset-0 z-10 flex will-change-transform">
          <div
            ref={reg("heroInner")}
            className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 pb-28 pt-20 text-center sm:px-8 sm:pt-24 lg:max-w-4xl lg:pb-16 lg:pt-28"
          >
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto inline-flex max-w-full items-center gap-2 truncate rounded-full border border-line bg-white/90 px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-ink sm:text-xs"
            >
              <GitHubMark className="h-3.5 w-3.5 shrink-0" /> {REPO_SLUG} · MIT
            </a>
            <p className="mt-5 font-mono text-[11px] tracking-[0.18em] text-accent-ink sm:mt-6 sm:text-sm">CODEX SIFT</p>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(1.85rem,8.2vw,4.75rem)] font-semibold leading-[1.08] tracking-[-0.045em] sm:max-w-4xl sm:leading-[1.02]">
              Model router for the Codex CLI
            </h1>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-muted sm:mt-5 sm:text-[clamp(1rem,1.8vw,1.25rem)]">
              Each user turn goes to flash, craft or forge before Codex bills it. On twelve live prompts that cut estimated quota{" "}
              <span className="text-ink">53.7%</span> versus always-forge.
            </p>
            <div className="pointer-events-auto mt-6 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <MagneticButton href="#quick-start" className="w-full sm:w-auto">
                Install Codex Sift
              </MagneticButton>
              <MagneticButton href={REPO_URL} variant="secondary" external className="w-full sm:w-auto">
                <GitHubMark /> GitHub
              </MagneticButton>
            </div>
            <span className="mt-8 rounded-full border border-line bg-white px-4 py-1.5 font-mono text-[11px] text-muted sm:mt-10 lg:absolute lg:inset-x-0 lg:bottom-5 lg:mx-auto lg:mt-0 lg:w-fit lg:border-0">
              Scroll to follow one request ↓
            </span>
          </div>
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(42svh,290px)] border-t border-line bg-white lg:hidden" />

        {/* chapter captions */}
        <div className="pointer-events-none absolute inset-x-4 bottom-[116px] z-[2] sm:inset-x-8 lg:inset-x-auto lg:bottom-auto lg:left-10 lg:top-[56%] lg:z-auto lg:w-[340px] xl:left-16">
          <div className="relative h-0">
            {CHAPTERS.map((c, i) => (
              <div
                key={c.eyebrow}
                ref={reg(`cap${i}`)}
                className="absolute inset-x-0 bottom-0 opacity-0 will-change-transform"
                style={{ visibility: "hidden" }}
              >
                <p className="eyebrow">{c.eyebrow}</p>
                <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight lg:text-[1.65rem]">{c.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted lg:text-[15px]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* request chooser */}
        <div
          ref={reg("chips")}
          className="absolute inset-x-4 bottom-4 z-[2] sm:inset-x-8 lg:inset-x-auto lg:bottom-10 lg:left-10 lg:z-auto lg:w-[340px] xl:left-16"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="uppercase tracking-wider text-muted">Routing demo</span>
            <button type="button" onClick={routeRandomExample} className="rounded px-2 text-accent-ink hover:underline">
              Random request ↻
            </button>
          </div>
          <div role="group" aria-label="Choose an example request" className="mt-2 grid grid-cols-3 gap-2">
            {LANE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={lane === id}
                onClick={() => setLane(id)}
                className={`min-h-11 rounded-xl border px-3 text-left transition-colors ${lane === id ? "border-accent bg-tint" : "border-line bg-white hover:border-accent/60 hover:bg-wash"}`}
              >
                <span className="block font-mono text-xs font-medium">{id}</span>
                <span className="block truncate text-[11px] text-muted">{LANES[id].model}</span>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-2 line-clamp-2 font-mono text-[11px] leading-snug text-muted">“{example}”</p>
        </div>

        <Tooltip ref={tip} />
      </div>
    </div>
  );
}
