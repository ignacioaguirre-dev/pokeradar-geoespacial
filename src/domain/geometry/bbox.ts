import type { BBox, Ring } from "./types";

export function bbox(ring: Ring): BBox {
  if (ring.length === 0) throw new RangeError("bbox needs at least one vertex.");
  let [west, south] = ring[0];
  let [east, north] = ring[0];
  for (const [lng, lat] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}
