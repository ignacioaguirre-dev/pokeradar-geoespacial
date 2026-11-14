import { bbox } from "./bbox";
import { onSegment } from "./segments";
import type { LngLat, Ring } from "./types";

// Boundary points count as inside so the answer never depends on float rounding of the ray.
export function pointInRing(point: LngLat, ring: Ring): boolean {
  if (ring.length < 3) return false;
  const [west, south, east, north] = bbox(ring);
  const [x, y] = point;
  if (x < west || x > east || y < south || y > north) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (onSegment(point, a, b)) return true;
    const [ax, ay] = a;
    const [bx, by] = b;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
