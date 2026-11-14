import type { LngLat, Ring } from "@/domain/geometry/types";
import type { Habitat } from "@/domain/habitat/types";

// Each polygon is its outer ring followed by its holes (GeoJSON order).
export type HabitatArea = { readonly habitat: Habitat; readonly polygons: readonly (readonly Ring[])[] };

export type Site = { readonly id: string; readonly habitat: Habitat; readonly point: LngLat };

export type SpeciesRef = { readonly id: number; readonly habitat: Habitat };

export type Sighting = { readonly speciesId: number; readonly point: LngLat };
