import type { Ring } from "./types";

// IUGG mean radius: the one the reference areas in the tests use.
const EARTH_RADIUS_KM = 6371.0088;
const RADIANS = Math.PI / 180;

// Spherical approximation: cheap, exact along meridians and parallels and close enough for fence-sized rings.
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
