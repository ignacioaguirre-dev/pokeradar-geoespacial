import type { LngLat } from "@/domain/geometry/types";

export type SiteHabitat = "urban" | "cave" | "rare";

// Visible names live in the Sites namespace of next-intl, keyed by id
export type Site = { readonly id: string; readonly habitat: SiteHabitat; readonly point: LngLat };

// Habitats with no ecoregion behind them: real places picked by hand
export const SITES: readonly Site[] = [
  { id: "buenos-aires", habitat: "urban", point: [-58.382, -34.604] },
  { id: "cordoba", habitat: "urban", point: [-64.183, -31.417] },
  { id: "rosario", habitat: "urban", point: [-60.65, -32.947] },
  { id: "mendoza", habitat: "urban", point: [-68.845, -32.889] },
  { id: "tucuman", habitat: "urban", point: [-65.205, -26.808] },
  { id: "mar-del-plata", habitat: "urban", point: [-57.556, -38.002] },
  { id: "salta", habitat: "urban", point: [-65.412, -24.789] },
  { id: "neuquen", habitat: "urban", point: [-68.059, -38.952] },
  // Wikipedia / UNESCO site coordinates
  { id: "cueva-de-las-manos", habitat: "cave", point: [-70.657, -47.156] },
  { id: "caverna-de-las-brujas", habitat: "cave", point: [-69.82, -35.801] },
  // Cerro Leones, Dina Huapi, 15 km from Bariloche
  { id: "cueva-de-los-leones", habitat: "cave", point: [-71.141, -41.083] },
  { id: "aconcagua", habitat: "rare", point: [-70.011, -32.653] },
  // The glacier front over Canal de los Témpanos
  { id: "perito-moreno", habitat: "rare", point: [-73.048, -50.481] },
  // Garganta del Diablo, Argentine side
  { id: "iguazu-falls", habitat: "rare", point: [-54.437, -25.689] },
  { id: "ischigualasto", habitat: "rare", point: [-67.842, -30.162] },
];
