import { describe, expect, it } from "vitest";
import type { MapColors } from "./colors";
import { buildStyle } from "./style";

// Obviously fake values: the test only checks that every color comes from here
const COLORS: MapColors = {
  sea: "marker-sea",
  land: "marker-land",
  coast: "marker-coast",
  border: "marker-border",
  province: "marker-province",
  label: "marker-label",
  city: "marker-city",
};

const style = buildStyle(COLORS);
const layers = style.layers;

describe("buildStyle", () => {
  it("every layer reads an OpenMapTiles source-layer", () => {
    const allowed = ["water", "waterway", "boundary", "water_name", "place"];
    for (const layer of layers) {
      if (layer.type === "background") continue;
      expect("source-layer" in layer ? layer["source-layer"] : undefined, layer.id).toBeOneOf(allowed);
    }
  });

  it("labels fall back from name:es to name", () => {
    const symbols = layers.filter((l) => l.type === "symbol");
    expect(symbols.length).toBeGreaterThan(0);
    for (const layer of symbols) {
      expect(layer.layout?.["text-field"], layer.id).toEqual([
        "coalesce",
        ["get", "name:es"],
        ["get", "name"],
      ]);
    }
  });

  it("uses only the given colors", () => {
    const markers = new Set(Object.values(COLORS));
    const used = new Set<string>();
    JSON.stringify(style, (key, value: unknown) => {
      if (/color$/.test(key)) used.add(String(value));
      return value;
    });
    expect(used.size).toBeGreaterThan(0);
    for (const color of used) expect(markers, color).toContain(color);
    // Every given color shows up somewhere in the style
    expect([...used].sort()).toEqual([...markers].sort());
  });

  it("uses fonts that OpenFreeMap serves", () => {
    const served = ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"];
    for (const layer of layers) {
      if (layer.type !== "symbol") continue;
      const fonts = layer.layout?.["text-font"];
      expect(Array.isArray(fonts), layer.id).toBe(true);
      for (const font of fonts as string[]) expect(served, layer.id).toContain(font);
    }
  });
});

describe("Malvinas label", () => {
  // OpenMapTiles carries the archipelago as a country place with iso_a2 FK
  const islands = layers.find((l) => l.id === "place-island");

  it("labels the archipelago from the tile's own place", () => {
    expect(islands?.type).toBe("symbol");
    expect(islands && "source-layer" in islands ? islands["source-layer"] : undefined).toBe("place");
    expect(islands && "filter" in islands ? islands.filter : undefined).toEqual([
      "all",
      ["==", ["get", "class"], "country"],
      ["==", ["get", "iso_a2"], "FK"],
    ]);
  });

  it("reads the Spanish name with the served italic font", () => {
    if (islands?.type !== "symbol") throw new Error("missing place-island symbol layer");
    expect(islands.layout?.["text-field"]).toEqual(["coalesce", ["get", "name:es"], ["get", "name"]]);
    expect(islands.layout?.["text-font"]).toEqual(["Noto Sans Italic"]);
  });
});
