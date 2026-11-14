import habitats from "@/data/habitats.geojson";
import { SITES } from "@/data/sites";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { isAreaHabitat } from "@/domain/habitat/types";
import type { HabitatArea, Site } from "@/domain/sightings/types";

type Position = readonly number[];

// Structural: the bundled GeoJSON and hand-made fixtures both fit
type HabitatFeatures = {
  readonly features: readonly {
    readonly properties: { readonly habitat: string };
    readonly geometry:
      | { readonly type: "Polygon"; readonly coordinates: readonly (readonly Position[])[] }
      | { readonly type: "MultiPolygon"; readonly coordinates: readonly (readonly (readonly Position[])[])[] };
  }[];
};

// GeoJSON repeats the first vertex at the end; domain rings are open
function toRing(positions: readonly Position[]): Ring {
  const ring = positions.map(([lng, lat]): LngLat => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

export function toHabitatAreas(collection: HabitatFeatures): HabitatArea[] {
  return collection.features.flatMap(({ properties: { habitat }, geometry }) => {
    if (!isAreaHabitat(habitat)) return [];
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return [{ habitat, polygons: polygons.map((rings) => rings.map(toRing)) }];
  });
}

export const HABITAT_AREAS: readonly HabitatArea[] = toHabitatAreas(habitats);

export const SIGHTING_SITES: readonly Site[] = SITES;
