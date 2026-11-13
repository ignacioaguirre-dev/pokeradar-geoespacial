export type ColorUsage = {
  kind: "base" | "text" | "graphic" | "decorative";
  // WCAG minimum against the page backgrounds; null when none applies
  minimum: number | null;
};

// Single source for what each color token is allowed to be used for
export const COLOR_USAGE = {
  background: { kind: "base", minimum: null },
  surface: { kind: "decorative", minimum: null },
  foreground: { kind: "text", minimum: 4.5 },
  muted: { kind: "text", minimum: 4.5 },
  structure: { kind: "decorative", minimum: null },
  control: { kind: "graphic", minimum: 3 },
  habitat: { kind: "text", minimum: 4.5 },
  condition: { kind: "text", minimum: 4.5 },
  energy: { kind: "graphic", minimum: 3 },
  alert: { kind: "text", minimum: 4.5 },
  "map-sea": { kind: "decorative", minimum: null },
  "map-land": { kind: "decorative", minimum: null },
  "map-coast": { kind: "decorative", minimum: null },
  "map-border": { kind: "decorative", minimum: null },
  "map-province": { kind: "decorative", minimum: null },
  "biome-forest": { kind: "decorative", minimum: null },
  "biome-grassland": { kind: "decorative", minimum: null },
  "biome-waters-edge": { kind: "decorative", minimum: null },
  "biome-mountain": { kind: "decorative", minimum: null },
  "biome-rough-terrain": { kind: "decorative", minimum: null },
  "biome-sea": { kind: "decorative", minimum: null },
} as const satisfies Record<string, ColorUsage>;

export type ColorToken = keyof typeof COLOR_USAGE;

// null when the usage has no minimum to meet
export function meetsUsage(ratio: number, usage: ColorUsage): boolean | null {
  return usage.minimum === null ? null : ratio >= usage.minimum;
}
