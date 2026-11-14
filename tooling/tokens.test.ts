import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, contrastRatio } from "../src/domain/color/contrast";
import { colorDistance } from "../src/domain/color/distance";
import { BIOME_OPACITY } from "../src/domain/color/biome";
import { CURVE_OUT } from "../src/components/ui/motion-tokens";
import { COLOR_USAGE } from "../src/domain/color/usage";

const SRC = join(__dirname, "..", "src");
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");

function themeColors(): Record<string, string> {
  const block = CSS.match(/@theme\s+static\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const colors: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    colors[m[1]] = m[2];
  }
  return colors;
}

const C = themeColors();

const PAIRS: ReadonlyArray<{
  foreground: string[];
  background: string[];
  kind: "text" | "graphic";
  minimum: number;
}> = [
  // Every token with a minimum must meet it on both page backgrounds
  ...Object.entries(COLOR_USAGE).flatMap(([name, usage]) =>
    usage.minimum === null
      ? []
      : [
          {
            foreground: [name],
            background: ["background", "surface"],
            kind: usage.kind as "text" | "graphic",
            minimum: usage.minimum,
          },
        ],
  ),
  { foreground: ["background"], background: ["habitat", "foreground", "muted"], kind: "text", minimum: 4.5 },
  // Map labels are text over the land and sea fills
  { foreground: ["muted", "foreground"], background: ["map-land", "map-sea"], kind: "text", minimum: 4.5 },
  { foreground: ["map-coast"], background: ["map-sea"], kind: "graphic", minimum: 3 },
  { foreground: ["map-border"], background: ["map-land"], kind: "graphic", minimum: 3 },
];

// The fence and its rings are drawn over the land, over every biome as the map paints it, and over the shelf sea
const BIOMES_OVER_LAND = ["forest", "grassland", "waters-edge", "mountain", "rough-terrain"];
const SWEEP_GROUNDS: ReadonlyArray<{ name: string; color: string }> = [
  { name: "map-land", color: C["map-land"] },
  { name: "map-sea", color: C["map-sea"] },
  ...BIOMES_OVER_LAND.map((biome) => ({
    name: `biome-${biome} over map-land`,
    color: composite(C[`biome-${biome}`], C["map-land"], BIOME_OPACITY),
  })),
  { name: "biome-sea over map-sea", color: composite(C["biome-sea"], C["map-sea"], BIOME_OPACITY) },
];

describe("contrastRatio with the palette", () => {
  it("matches the reference values", () => {
    expect(contrastRatio("#0B0E12", "#F1EDE4")).toBeCloseTo(16.55, 1);
    expect(contrastRatio("#0B0E12", "#3B3832")).toBeCloseTo(1.66, 1);
  });
});

describe("token contrast", () => {
  it("every token has a declared usage", () => {
    expect(Object.keys(COLOR_USAGE).sort()).toEqual(Object.keys(C).sort());
  });

  it("defines every expected color", () => {
    expect(Object.keys(C).sort()).toEqual(
      [
        "background", "surface", "foreground", "muted", "structure",
        "control", "habitat", "condition", "energy", "alert",
        "map-sea", "map-land", "map-coast", "map-border", "map-province",
        "biome-forest", "biome-grassland", "biome-waters-edge", "biome-mountain",
        "biome-rough-terrain", "biome-sea", "sweep",
      ].sort(),
    );
  });

  for (const ground of SWEEP_GROUNDS) {
    it(`sweep on ${ground.name} meets 3 (graphic)`, () => {
      expect(contrastRatio(C.sweep, ground.color)).toBeGreaterThanOrEqual(3);
    });
  }

  // The rings and the traces cross, and the fence runs under labels: it must not read as one more trace
  // or as text. Contrast cannot tell them apart (all light), color distance can: the candidates dropped
  // for passing as the text sat near ΔE 10
  for (const other of ["habitat", "foreground"]) {
    it(`sweep stays at least ΔE 15 from ${other}`, () => {
      expect(colorDistance(C.sweep, C[other])).toBeGreaterThanOrEqual(15);
    });
  }

  for (const pair of PAIRS) {
    for (const fg of pair.foreground) {
      for (const bg of pair.background) {
        it(`${fg} on ${bg} meets ${pair.minimum} (${pair.kind})`, () => {
          expect(contrastRatio(C[fg], C[bg])).toBeGreaterThanOrEqual(pair.minimum);
        });
      }
    }
  }
});

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return /\.(ts|tsx|css)$/.test(e.name) ? [path] : [];
  });
}

describe("no loose colors", () => {
  const FUNCTIONS = "rgba?|hsla?|lab|lch|oklab|oklch|hwb|color-mix";
  const NAMES =
    "red|blue|green|white|black|gray|grey|orange|yellow|purple|pink|cyan|teal|navy|brown|transparent|currentcolor";
  const forbidden = new RegExp(
    [
      String.raw`#[0-9a-fA-F]{3,8}\b`,
      String.raw`\b(?:${FUNCTIONS})\(`,
      // Arbitrary color classes such as bg-[red]
      String.raw`-\[(?:${NAMES})\]`,
      // Inline style or CSS declarations with a named color
      String.raw`\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*["'\x60]?(?:${NAMES})\b`,
    ].join("|"),
    "i",
  );
  const candidates = files(SRC).filter(
    (f) => !f.endsWith("globals.css") && !/\.test\.tsx?$/.test(f),
  );

  it("the detector catches the forbidden cases", () => {
    const bad = [
      "#fff", "#A1B2C3", "rgb(1,2,3)", "rgba(0,0,0,.5)", "hsl(0 0% 0%)", "hsla(0,0%,0%,1)",
      "lab(50 0 0)", "lch(50 0 0)", "oklab(1 0 0)", "oklch(0.5 0.1 20)", "hwb(0 0% 0%)",
      "color-mix(in srgb, red, blue)", "bg-[#123456]", "text-[rgb(1,2,3)]", "bg-[red]",
      "text-[oklch(1 0 0)]", 'style={{ color: "red" }}', "background: white",
    ];
    for (const sample of bad) {
      expect(forbidden.test(sample), sample).toBe(true);
    }
    expect(forbidden.test("bg-background text-foreground border-control")).toBe(false);
  });

  it("no file in src uses colors outside the tokens", () => {
    const offenders = candidates.filter((f) => forbidden.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the theme closes Tailwind's default palette", () => {
    // Without this reset, classes like bg-red-500 or text-white still generate colors
    expect(CSS).toMatch(/@theme\s+static\s*\{\s*--color-\*:\s*initial;/);
  });
});

describe("colors reserved for the map", () => {
  // Tag is the one UI piece that labels habitat and condition by definition
  const ALLOWED = ["tag.tsx", "tag.test.tsx"];
  const UI = join(SRC, "components", "ui");
  const utility =
    /\b(?:[a-z-]+:)*(?:bg|text|border(?:-[a-z]{1,2})?|outline|ring|fill|stroke|from|to|via|decoration|shadow|accent|caret|divide)-(?:habitat|condition)\b/;

  it("the detector catches the forbidden utilities", () => {
    for (const bad of ["bg-habitat", "text-condition", "focus-visible:outline-habitat", "border-l-condition"]) {
      expect(utility.test(bad), bad).toBe(true);
    }
    expect(utility.test("bg-foreground text-background")).toBe(false);
  });

  it("no piece of components/ui uses habitat or condition", () => {
    const offenders = files(UI).filter(
      (f) => !ALLOWED.some((a) => f.endsWith(a)) && utility.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("motion tokens", () => {
  // motion needs the curve as numbers; this keeps that copy tied to the CSS token
  it("CURVE_OUT matches --curve-out", () => {
    const raw = /--curve-out:\s*cubic-bezier\(([^)]+)\);/.exec(CSS)?.[1];
    expect(raw?.split(",").map(Number)).toEqual([...CURVE_OUT]);
  });

  // The stylesheet is the source; any script copy outside motion-tokens drifts silently
  it("no other module keeps its own copy of the curve", () => {
    const copies = files(SRC).filter(
      (f) => /\.tsx?$/.test(f) && !f.endsWith("motion-tokens.ts") && /0\.16,\s*1,\s*0\.3,\s*1/.test(readFileSync(f, "utf8")),
    );
    expect(copies).toEqual([]);
  });
});
