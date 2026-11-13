import { bbox } from "./bbox";
import { DEGENERATE_AREA, signedPlanarArea } from "./planar-area";
import { pointInRing } from "./point-in-ring";
import type { LngLat, Ring } from "./types";

// mulberry32: tiny, fast and good enough for spreading sightings; same seed, same sequence.
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rejection sampling inside the bbox. A flat ring would accept points on its edge, so it is ruled out first.
export function randomPointInRing(ring: Ring, rng: () => number, maxAttempts = 1000): LngLat | null {
  if (ring.length < 3 || Math.abs(signedPlanarArea(ring)) < DEGENERATE_AREA) return null;
  const [west, south, east, north] = bbox(ring);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const point: LngLat = [west + rng() * (east - west), south + rng() * (north - south)];
    if (pointInRing(point, ring)) return point;
  }
  return null;
}
