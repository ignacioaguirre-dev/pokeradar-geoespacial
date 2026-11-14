import { bbox } from "@/domain/geometry/bbox";
import { centroid } from "@/domain/geometry/centroid";
import { pointInRing } from "@/domain/geometry/point-in-ring";
import type { Fence, LngLat } from "@/domain/geometry/types";
import type { Sighting } from "./types";

// The resolution of one sweep: more markers would crowd the fence; the rest become weak signals.
export const TRACED_LIMIT = 12;

export type Detection = { readonly traced: Sighting[]; readonly weakSignals: number };

const RADIANS = Math.PI / 180;

// Equirectangular: only the order matters, and fences are small enough for it to hold.
function distanceSquared([lng, lat]: LngLat, [cx, cy]: LngLat, lngScale: number): number {
  const dx = (lng - cx) * lngScale;
  const dy = lat - cy;
  return dx * dx + dy * dy;
}

export function detect(fence: Fence, sightings: readonly Sighting[], limit = TRACED_LIMIT): Detection {
  const { ring } = fence;
  if (ring.length < 3) return { traced: [], weakSignals: 0 };
  const [west, south, east, north] = bbox(ring);
  const center = centroid(ring);
  const lngScale = Math.cos(center[1] * RADIANS);

  // One per species: its sighting nearest the centroid
  const nearest = new Map<number, { sighting: Sighting; distance: number }>();
  for (const sighting of sightings) {
    const [lng, lat] = sighting.point;
    // The bbox check is cheap and rejects almost every point of the country
    if (lng < west || lng > east || lat < south || lat > north) continue;
    if (!pointInRing(sighting.point, ring)) continue;
    const distance = distanceSquared(sighting.point, center, lngScale);
    const current = nearest.get(sighting.speciesId);
    if (!current || distance < current.distance) nearest.set(sighting.speciesId, { sighting, distance });
  }

  const ordered = [...nearest.values()]
    .sort((a, b) => a.distance - b.distance || a.sighting.speciesId - b.sighting.speciesId)
    .map((entry) => entry.sighting);
  return { traced: ordered.slice(0, limit), weakSignals: Math.max(0, ordered.length - limit) };
}
