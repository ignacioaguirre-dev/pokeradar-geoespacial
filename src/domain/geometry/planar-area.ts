import type { Ring } from "./types";

// Square degrees; below this the ring encloses nothing usable.
export const DEGENERATE_AREA = 1e-12;

// Relative to the first vertex to keep precision with coordinates far from 0,0.
export function signedPlanarArea(ring: Ring): number {
  if (ring.length < 3) return 0;
  const [ox, oy] = ring[0];
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    twice += (ax - ox) * (by - oy) - (bx - ox) * (ay - oy);
  }
  return twice / 2;
}
