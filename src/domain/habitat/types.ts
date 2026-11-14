// The nine PokéAPI habitats (Gen I–III). Lives in domain so the catalog, the static data and the map
// share one definition without crossing the folder boundaries. Ordered by PokéAPI id (1–9): the catalog
// fetches /pokemon-habitat/{index + 1}.
export const HABITATS = [
  "cave",
  "forest",
  "grassland",
  "mountain",
  "rare",
  "rough-terrain",
  "sea",
  "urban",
  "waters-edge",
] as const;

export type Habitat = (typeof HABITATS)[number];

// Backed by ecoregion polygons in src/data/habitats.geojson.
export const AREA_HABITATS = ["forest", "grassland", "mountain", "rough-terrain", "sea", "waters-edge"] as const;
// No ecoregion matches them: they live on hand-picked sites.
export const SITE_HABITATS = ["cave", "rare", "urban"] as const;

export type AreaHabitat = (typeof AREA_HABITATS)[number];
export type SiteHabitat = (typeof SITE_HABITATS)[number];

export function isAreaHabitat(value: string): value is AreaHabitat {
  return (AREA_HABITATS as readonly string[]).includes(value);
}
