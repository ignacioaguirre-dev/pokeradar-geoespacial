import habitats from "@/data/habitats.geojson";
import { ARGENTINA_OUTLINE } from "@/domain/geography/argentina-outline";
import { pointInPolygon } from "@/domain/geometry/point-in-polygon";
import { pointInRing } from "@/domain/geometry/point-in-ring";
import type { LngLat, Ring } from "@/domain/geometry/types";

type Position = readonly number[];
type Geometry =
  | { readonly type: "Polygon"; readonly coordinates: readonly (readonly Position[])[] }
  | { readonly type: "MultiPolygon"; readonly coordinates: readonly (readonly (readonly Position[])[])[] };

const toRing = (positions: readonly Position[]): Ring => positions.map(([lng, lat]): LngLat => [lng, lat]);

// Outer rings only: the shelf's holes are Malvinas and Isla de los Estados, which are Argentina too
function shelfRings(features: readonly { properties: { habitat: string }; geometry: Geometry }[]): Ring[] {
  return features
    .filter((f) => f.properties.habitat === "sea")
    .flatMap(({ geometry }) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates))
    .map(([outer]) => toRing(outer));
}

const SHELF = shelfRings(habitats.features);

// Continental Argentina or the Mar Argentino shelf: where an own fence may put its vertices
export function isInTerritory(point: LngLat): boolean {
  return (
    ARGENTINA_OUTLINE.coordinates.some((polygon) => pointInPolygon(point, polygon)) ||
    SHELF.some((ring) => pointInRing(point, ring))
  );
}
