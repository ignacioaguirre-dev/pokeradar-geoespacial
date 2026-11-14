import type { LngLat } from "./types";

// Degrees; absorbs float noise when a point is meant to sit exactly on a segment.
const EPSILON = 1e-12;

function orientation([ax, ay]: LngLat, [bx, by]: LngLat, [px, py]: LngLat): -1 | 0 | 1 {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) <= EPSILON) return 0;
  return cross > 0 ? 1 : -1;
}

function withinBox([px, py]: LngLat, [ax, ay]: LngLat, [bx, by]: LngLat): boolean {
  return (
    px >= Math.min(ax, bx) - EPSILON &&
    px <= Math.max(ax, bx) + EPSILON &&
    py >= Math.min(ay, by) - EPSILON &&
    py <= Math.max(ay, by) + EPSILON
  );
}

export function onSegment(point: LngLat, a: LngLat, b: LngLat): boolean {
  return orientation(a, b, point) === 0 && withinBox(point, a, b);
}

// Touching counts (shared ends, T, collinear overlap): a fence edge must not even graze another.
export function segmentsIntersect(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return (
    (o1 === 0 && withinBox(c, a, b)) ||
    (o2 === 0 && withinBox(d, a, b)) ||
    (o3 === 0 && withinBox(a, c, d)) ||
    (o4 === 0 && withinBox(b, c, d))
  );
}
