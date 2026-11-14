import type { AreaHabitat } from "@/domain/habitat/types";

export type MapColors = {
  sea: string;
  land: string;
  coast: string;
  border: string;
  province: string;
  label: string;
  city: string;
  biome: Record<AreaHabitat, string>;
};

// The style needs literal colors; reading the tokens keeps globals.css the only source
export function readMapColors(): MapColors {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  return {
    sea: token("map-sea"),
    land: token("map-land"),
    coast: token("map-coast"),
    border: token("map-border"),
    province: token("map-province"),
    label: token("muted"),
    city: token("foreground"),
    biome: {
      forest: token("biome-forest"),
      grassland: token("biome-grassland"),
      "waters-edge": token("biome-waters-edge"),
      mountain: token("biome-mountain"),
      "rough-terrain": token("biome-rough-terrain"),
      sea: token("biome-sea"),
    },
  };
}
