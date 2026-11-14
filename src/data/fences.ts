import type { Fence } from "@/domain/geometry/types";
import type { AreaHabitat } from "@/domain/habitat/types";

// The habitat its centroid falls in; the visible name lives in the Fences namespace of next-intl
export type PresetFence = Fence & { readonly habitat: AreaHabitat };

// One fence per recognizable biome, drawn by hand inside Argentina over src/data/habitats.geojson
export const FENCES: readonly PresetFence[] = [
  {
    id: "yungas",
    habitat: "forest",
    ring: [
      [-65.5, -22.3],
      [-64.7, -22.35],
      [-64.35, -22.95],
      [-63.4, -22.3],
      [-63.2, -24.2],
      [-64.4, -24.8],
      [-65.8, -24.1],
    ],
  },
  {
    id: "ibera",
    habitat: "waters-edge",
    ring: [
      [-58.3, -27.6],
      [-56.4, -27.6],
      [-56.0, -28.2],
      [-56.75, -29.2],
      [-57.5, -29.95],
      [-58.5, -30.1],
      [-58.7, -28.8],
    ],
  },
  {
    id: "pampa",
    habitat: "grassland",
    ring: [
      [-63.0, -34.0],
      [-59.5, -34.0],
      [-58.8, -35.5],
      [-59.6, -37.0],
      [-62.8, -37.0],
    ],
  },
  {
    id: "puna",
    habitat: "mountain",
    ring: [
      [-66.85, -22.55],
      [-66.0, -22.4],
      [-65.9, -24.0],
      [-66.3, -26.3],
      [-67.6, -26.7],
      [-68.25, -25.8],
      [-68.05, -24.65],
      [-67.0, -24.0],
    ],
  },
  {
    id: "monte",
    habitat: "rough-terrain",
    ring: [
      [-68.5, -36.8],
      [-66.5, -36.8],
      [-65.8, -38.3],
      [-66.6, -39.8],
      [-68.3, -39.8],
      [-69.0, -38.3],
    ],
  },
  {
    id: "patagonia",
    habitat: "rough-terrain",
    ring: [
      [-71.0, -45.4],
      [-68.5, -45.3],
      [-68.0, -46.6],
      [-68.8, -47.8],
      [-70.6, -47.8],
      [-71.2, -46.6],
    ],
  },
  {
    id: "sea",
    habitat: "sea",
    ring: [
      [-64.0, -43.8],
      [-60.3, -43.8],
      [-60.5, -45.4],
      [-62.0, -46.8],
      [-64.5, -46.2],
    ],
  },
  {
    // Smaller than the rest: Misiones is ~30 000 km², and a bigger fence would spill into Brazil or Paraguay
    id: "misiones",
    habitat: "forest",
    ring: [
      [-54.55, -25.72],
      [-53.92, -25.8],
      [-53.82, -26.75],
      [-54.3, -27.33],
      [-55.6, -28.1],
      [-55.75, -27.5],
      [-55.1, -27.0],
      [-54.75, -26.6],
    ],
  },
];
