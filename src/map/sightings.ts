import type { CompactSighting } from "@/domain/sightings/compact";

// Faint on purpose: the layer hints where life is; the sweep (08) is what reveals it.
// From zoom 5 only: over the whole country ~1 700 dots are noise
export const SIGHTINGS_SOURCE = "sightings";
export const SIGHTING_MIN_ZOOM = 5;
export const SIGHTING_RADIUS = 2;
export const SIGHTING_OPACITY = 0.5;

export type SightingCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { speciesId: number };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

export function toSightingCollection(sightings: readonly CompactSighting[]): SightingCollection {
  return {
    type: "FeatureCollection",
    features: sightings.map(([speciesId, lng, lat]) => ({
      type: "Feature",
      properties: { speciesId },
      geometry: { type: "Point", coordinates: [lng, lat] },
    })),
  };
}
