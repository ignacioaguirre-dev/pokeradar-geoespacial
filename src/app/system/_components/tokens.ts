import { contrastRatio } from "@/domain/color/contrast";
import { COLOR_USAGE, meetsUsage, type ColorToken, type ColorUsage } from "@/domain/color/usage";

export type Token = { name: ColorToken; swatch: string };

// Full class names so Tailwind can see them statically
export const TOKENS: readonly Token[] = [
  { name: "background", swatch: "bg-background" },
  { name: "surface", swatch: "bg-surface" },
  { name: "foreground", swatch: "bg-foreground" },
  { name: "muted", swatch: "bg-muted" },
  { name: "structure", swatch: "bg-structure" },
  { name: "control", swatch: "bg-control" },
  { name: "habitat", swatch: "bg-habitat" },
  { name: "condition", swatch: "bg-condition" },
  { name: "energy", swatch: "bg-energy" },
  { name: "alert", swatch: "bg-alert" },
  { name: "map-sea", swatch: "bg-map-sea" },
  { name: "map-land", swatch: "bg-map-land" },
  { name: "map-coast", swatch: "bg-map-coast" },
  { name: "map-border", swatch: "bg-map-border" },
  { name: "map-province", swatch: "bg-map-province" },
  { name: "map-space", swatch: "bg-map-space" },
  { name: "biome-forest", swatch: "bg-biome-forest" },
  { name: "biome-grassland", swatch: "bg-biome-grassland" },
  { name: "biome-waters-edge", swatch: "bg-biome-waters-edge" },
  { name: "biome-mountain", swatch: "bg-biome-mountain" },
  { name: "biome-rough-terrain", swatch: "bg-biome-rough-terrain" },
  { name: "biome-sea", swatch: "bg-biome-sea" },
];

const DISPLAY = "font-display font-stretch-condensed font-bold uppercase";

// Each step is shown with the family it is really used in; null means the condensed display cut
export const TYPE_SCALE = [
  { name: "label", className: `text-label ${DISPLAY}`, family: null },
  { name: "body", className: "text-body font-sans", family: "Chivo" },
  { name: "subtitle", className: "text-subtitle font-sans", family: "Chivo" },
  { name: "title", className: `text-title ${DISPLAY}`, family: null },
  { name: "headline", className: `text-headline ${DISPLAY}`, family: null },
  { name: "hero", className: `text-hero ${DISPLAY}`, family: null },
] as const;

export const DURATIONS = [
  { name: "fast", ms: 120 },
  { name: "medium", ms: 240 },
  { name: "sweep", ms: 900 },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export type Contrast =
  | { kind: "pending" }
  | { kind: "base" }
  | { kind: "measured"; ratio: number; meets: boolean | null };

export function usageOf(name: ColorToken): ColorUsage {
  return COLOR_USAGE[name];
}

// Values are empty until hydration; the base color has no contrast against itself
export function contrastOnBackground(name: ColorToken, value: string, background: string): Contrast {
  if (!HEX.test(value) || !HEX.test(background)) return { kind: "pending" };
  if (name === "background") return { kind: "base" };
  const ratio = contrastRatio(value, background);
  return { kind: "measured", ratio, meets: meetsUsage(ratio, usageOf(name)) };
}
