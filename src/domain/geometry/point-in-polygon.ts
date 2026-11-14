import { pointInRing } from "./point-in-ring";
import type { LngLat, Ring } from "./types";

// GeoJSON order: the outer ring first, then holes. A hole's edge belongs to the hole,
// so a point there falls in the neighbor that fills it and never in both.
export function pointInPolygon(point: LngLat, rings: readonly Ring[]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}
