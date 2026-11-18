import { LANE_ORDER, type LaneId } from "./content";

export type Mode = 880 | 700 | 600;

export type Fonts = { xs: number; sm: number; md: number; lg: number; model: number };

export type Geo = {
  W: number;
  H: number;
  cx: number;
  fs: Fonts;
  laneX: Record<LaneId, number>;
  cardW: number;
  pillY: number;
  labelYs: number[];
  router: { x: number; y: number; w: number; h: number };
  branchY: number;
  laneY: number;
  card: { y: number; h: number };
  tui: { y: number };
};

const PRESETS: Record<Mode, { cx: number; dx: number; cardW: number; routerW: number; fs: Fonts }> = {
  880: { cx: 440, dx: 262, cardW: 224, routerW: 380, fs: { xs: 13, sm: 15, md: 18, lg: 26, model: 18 } },
  700: { cx: 350, dx: 218, cardW: 190, routerW: 380, fs: { xs: 14, sm: 16, md: 19, lg: 26, model: 17 } },
  600: { cx: 300, dx: 190, cardW: 176, routerW: 400, fs: { xs: 15, sm: 17, md: 19, lg: 26, model: 17 } },
};

export function makeGeo(mode: Mode): Geo {
  const p = PRESETS[mode];
  const laneX = {} as Record<LaneId, number>;
  LANE_ORDER.forEach((id, i) => {
    laneX[id] = p.cx + (i - 1) * p.dx;
  });
  return {
    W: mode,
    H: 2500,
    cx: p.cx,
    fs: p.fs,
    laneX,
    cardW: p.cardW,
    pillY: 100,
    labelYs: [300, 460, 620],
    router: { x: p.cx - p.routerW / 2, y: 780, w: p.routerW, h: 270 },
    branchY: 1140,
    laneY: 1340,
    card: { y: 1520, h: 190 },
    tui: { y: 1900 },
  };
}

export const SPINE_START = 120;

export function branchD(g: Geo, lane: LaneId): string {
  const x = g.laneX[lane];
  return `M ${g.cx} ${g.branchY} C ${g.cx} ${g.branchY + 100}, ${x} ${g.laneY - 100}, ${x} ${g.laneY}`;
}

export function connectorD(g: Geo, lane: LaneId): string {
  const x = g.laneX[lane];
  return `M ${x} ${g.laneY} L ${x} ${g.card.y}`;
}

export function returnD(g: Geo, lane: LaneId): string {
  const x = g.laneX[lane];
  const y0 = g.card.y + g.card.h;
  const y1 = g.tui.y - 20;
  return `M ${x} ${y0} C ${x} ${y0 + 90}, ${g.cx} ${y1 - 92}, ${g.cx} ${y1}`;
}

export function requestD(g: Geo, lane: LaneId): string {
  const x = g.laneX[lane];
  return [
    `M ${g.cx} ${SPINE_START} L ${g.cx} ${g.branchY}`,
    `C ${g.cx} ${g.branchY + 100}, ${x} ${g.laneY - 100}, ${x} ${g.laneY}`,
    `L ${x} ${g.card.y}`,
  ].join(" ");
}

function bezierLength(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= 48; i++) {
    const t = i / 48;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    len += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
  }
  return len;
}

/** Approximate distances along the request path at which each station sits. */
export function stations(g: Geo, lane: LaneId) {
  const x = g.laneX[lane];
  const branchLen = bezierLength(
    [g.cx, g.branchY],
    [g.cx, g.branchY + 100],
    [x, g.laneY - 100],
    [x, g.laneY],
  );
  const dBranch = g.branchY - SPINE_START;
  const dLane = dBranch + branchLen;
  const dModel = dLane + (g.card.y - g.laneY);
  return {
    dRouterTop: g.router.y - SPINE_START,
    dRouterBot: g.router.y + g.router.h - SPINE_START,
    dBranch,
    dLane,
    dModel,
    total: dModel,
  };
}
