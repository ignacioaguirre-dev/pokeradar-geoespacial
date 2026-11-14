import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARGENTINA_OUTLINE } from "@/domain/geography/argentina-outline";
import { pointInPolygon } from "@/domain/geometry/point-in-polygon";
import type { LngLat, Ring } from "@/domain/geometry/types";

type Polygon = LngLat[][];

export type HabitatFeature = {
  type: string;
  properties: { habitat: string };
  geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
};

export const HABITATS_PATH = join(__dirname, "..", "data", "habitats.geojson");

// Read from disk: the data tests also check the raw file (size, decimals)
export const HABITAT_COLLECTION = JSON.parse(readFileSync(HABITATS_PATH, "utf8")) as {
  type: string;
  features: HabitatFeature[];
};

export function polygonsOf(feature: HabitatFeature): Polygon[] {
  return feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

export function habitatsAt(point: LngLat): string[] {
  return HABITAT_COLLECTION.features
    .filter((f) => polygonsOf(f).some((polygon) => pointInPolygon(point, polygon as Ring[])))
    .map((f) => f.properties.habitat);
}

// Land only: the outline has no sea, and Malvinas are outside it
export function onArgentineLand(point: LngLat): boolean {
  return ARGENTINA_OUTLINE.coordinates.some((polygon) => pointInPolygon(point, polygon));
}
