import { DEGENERATE_AREA, signedPlanarArea } from "./planar-area";
import type { LngLat, Ring } from "./types";

function vertexAverage(ring: Ring): LngLat {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lng / ring.length, lat / ring.length];
}

// Planar in lng/lat: fences are small enough for the distortion not to matter.
export function centroid(ring: Ring): LngLat {
  if (ring.length === 0) throw new RangeError("centroid needs at least one vertex.");
  const area = signedPlanarArea(ring);
  if (Math.abs(area) < DEGENERATE_AREA) return vertexAverage(ring);

  const [ox, oy] = ring[0];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const ax = ring[i][0] - ox;
    const ay = ring[i][1] - oy;
    const bx = ring[(i + 1) % ring.length][0] - ox;
    const by = ring[(i + 1) % ring.length][1] - oy;
    const cross = ax * by - bx * ay;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }
  return [ox + cx / (6 * area), oy + cy / (6 * area)];
}
