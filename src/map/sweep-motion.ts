import type { ExpressionSpecification } from "maplibre-gl";
import type { LngLat, Ring } from "@/domain/geometry/types";

type Curve = readonly [x1: number, y1: number, x2: number, y2: number];
type Ease = (t: number) => number;

// Each ring ends at a share of the fence's mean reach, so the outer one roughly follows its outline
export const RING_FRACTIONS = [1 / 3, 2 / 3, 1] as const;
// They stay once the sweep ends, faint inside so the creatures and the fence read first
export const RING_OPACITY = [0.35, 0.5, 0.7] as const;
const RING_START_OPACITY = 0.9;
// Rings leave a sixth of the duration apart; the traces start once the first ring is a third out
const RING_STAGGER = 1 / 6;
const TRACE_DELAY = 1 / 3;

// Faded tail and clear path as #rrggbbaa: the tokens are #rrggbb and the map needs literal colors
const TAIL_ALPHA = "66";
const CLEAR_ALPHA = "00";
const HEAD_GAP = 0.001;

// MapLibre lays the world on 512 px at zoom 0
const WORLD_PX = 512;
const MAX_ZOOM = 24;

// The --curve-* tokens as numbers; anything else means the caller falls back to linear
export function parseCurve(raw: string): Curve | null {
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(raw.trim());
  const values = match?.[1].split(",").map(Number);
  if (!values || values.length !== 4 || values.some((v) => !Number.isFinite(v))) return null;
  return [values[0], values[1], values[2], values[3]];
}

// The CSS timing function: find t where x(t) = progress, then read y(t)
export function cubicBezier([x1, y1, x2, y2]: Curve): Ease {
  const at = (a: number, b: number, t: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;
    let t = progress;
    // Bisection: always converges, and 30 halvings are far below a pixel
    for (let i = 0; i < 30; i++) {
      if (at(x1, x2, t) < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return at(y1, y2, t);
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from * (1 - t) + to * t;

export type SweepFrame = {
  rings: { scale: number; opacity: number }[];
  trace: number;
  done: boolean;
};

// Last ring out and traces home at the same moment: four thirds of the token
export function sweepLength(durationMs: number): number {
  return (durationMs * 4) / 3;
}

// The state of the sweep at a moment; with no duration (reduced motion) every moment is the end
export function sweepFrame(elapsedMs: number, durationMs: number, ease: Ease): SweepFrame {
  const progress = (delay: number) => (durationMs <= 0 ? 1 : clamp01((elapsedMs - delay * durationMs) / durationMs));
  return {
    rings: RING_FRACTIONS.map((fraction, i) => {
      const p = progress(i * RING_STAGGER);
      return { scale: ease(p) * fraction, opacity: lerp(RING_START_OPACITY, RING_OPACITY[i], p) };
    }),
    trace: ease(progress(TRACE_DELAY)),
    done: durationMs <= 0 || elapsedMs >= sweepLength(durationMs),
  };
}

function mercator([lng, lat]: LngLat): [number, number] {
  const x = ((lng + 180) / 360) * WORLD_PX;
  const y = ((180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360) * WORLD_PX;
  return [x, y];
}

// How far the fence reaches from its center, in pixels at zoom 0. The mean over the vertices: the farthest one
// would send the outer ring well past the other sides of an irregular fence
export function worldRadius(center: LngLat, ring: Ring): number {
  if (ring.length === 0) return 0;
  const [cx, cy] = mercator(center);
  let total = 0;
  for (const vertex of ring) {
    const [x, y] = mercator(vertex);
    total += Math.hypot(x - cx, y - cy);
  }
  return total / ring.length;
}

// circle-radius is in screen pixels; doubling it per zoom level keeps the ring the same size on the ground
export function ringRadius(worldPx: number, scale: number): ExpressionSpecification {
  const radius = worldPx * scale;
  return ["interpolate", ["exponential", 2], ["zoom"], 0, radius, MAX_ZOOM, radius * 2 ** MAX_ZOOM];
}

// line-gradient over each trace's own length: faint at the origin, full at the head, clear ahead of it
export function traceGradient(color: string, progress: number): ExpressionSpecification {
  const tail = color + TAIL_ALPHA;
  const clear = color + CLEAR_ALPHA;
  const stops: (number | string)[] =
    progress <= 0
      ? [0, clear, 1, clear]
      : progress >= 1 - HEAD_GAP
        ? [0, tail, 1, color]
        : [0, tail, progress, color, progress + HEAD_GAP, clear];
  return ["interpolate", ["linear"], ["line-progress"], ...stops] as ExpressionSpecification;
}
