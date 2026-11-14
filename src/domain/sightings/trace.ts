import type { LngLat } from "@/domain/geometry/types";

// Enough for a smooth curve at the zoom of a fence, few enough to redraw every frame.
export const TRACE_SAMPLES = 24;

// How far the control point sits off the chord, as a share of its length: the curve peaks at half of it.
const BEND = 0.3;

// The path from a sweep's origin to a detected creature: a quadratic curve that always bends to the right,
// like the tracks of same-charge particles in a bubble chamber. Planar in lng/lat, as fences are small.
export function trace(from: LngLat, to: LngLat, samples = TRACE_SAMPLES): LngLat[] {
  if (samples < 1) throw new RangeError("trace needs at least one sample.");
  const [ax, ay] = from;
  const [bx, by] = to;
  const dx = bx - ax;
  const dy = by - ay;
  // A creature right at the origin: rounding would scatter the samples around it
  if (dx === 0 && dy === 0) return Array.from({ length: samples + 1 }, () => from);
  // (dy, -dx) is the chord turned a quarter clockwise: its right-hand side
  const cx = (ax + bx) / 2 + dy * BEND;
  const cy = (ay + by) / 2 - dx * BEND;

  const points: LngLat[] = [from];
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  // The ends are the inputs themselves, so the trace lands exactly on the marker
  points.push(to);
  return points;
}
