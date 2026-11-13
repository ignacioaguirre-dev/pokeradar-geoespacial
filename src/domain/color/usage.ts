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
} as const satisfies Record<string, ColorUsage>;

export type ColorToken = keyof typeof COLOR_USAGE;

// null when the usage has no minimum to meet
export function meetsUsage(ratio: number, usage: ColorUsage): boolean | null {
  return usage.minimum === null ? null : ratio >= usage.minimum;
}
