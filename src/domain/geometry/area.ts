import type { Ring } from "./types";

// Mean Earth radius (IUGG), in km.
const EARTH_RADIUS_KM = 6371.0088;
const RADIANS = Math.PI / 180;

// Spherical ring area: R²/2 · |Σ (λ2 − λ1)(2 + sin φ1 + sin φ2)|. Exact along meridians and parallels.
export function areaKm2(ring: Ring): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    sum += (lng2 - lng1) * RADIANS * (2 + Math.sin(lat1 * RADIANS) + Math.sin(lat2 * RADIANS));
  }
  return (Math.abs(sum) * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2;
}
