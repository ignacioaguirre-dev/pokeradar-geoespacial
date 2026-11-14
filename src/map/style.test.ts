import { describe, expect, it } from "vitest";
import type { HabitatCollection } from "./habitats";
import type { MapColors } from "./colors";
import { BIOME_OPACITY } from "@/domain/color/biome";
import { ARGENTINA_OUTLINE } from "@/domain/geography/argentina-outline";
import type { CompactSighting } from "@/domain/sightings/compact";
import { MIN_ZOOM } from "./argentina";
import { INTRO_PROJECTION } from "./intro-flight";
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
  sighting: "marker-sighting",
  space: "marker-space",
  biome: {
    forest: "marker-forest",
    grassland: "marker-grassland",
    "waters-edge": "marker-waters-edge",
    mountain: "marker-mountain",
    "rough-terrain": "marker-rough-terrain",
    sea: "marker-sea-habitat",
  },
};

const HABITATS: HabitatCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { habitat: "forest" },
      geometry: { type: "Polygon", coordinates: [[[-65, -23], [-64, -23], [-64, -24], [-65, -23]]] },
    },
  ],
};

const SIGHTINGS: CompactSighting[] = [
  [25, -58.4, -34.6],
  [7, -60.1, -45.2],
];

const style = buildStyle(COLORS, HABITATS, SIGHTINGS);
const layers = style.layers;

const OWN_SOURCES = ["habitats", "sightings"];

describe("buildStyle", () => {
  it("every layer reads an OpenMapTiles source-layer", () => {
    const allowed = ["water", "waterway", "boundary", "water_name", "place"];
    for (const layer of layers) {
      if (layer.type === "background" || ("source" in layer && OWN_SOURCES.includes(layer.source))) continue;
      expect(
        "source-layer" in layer ? layer["source-layer"] : undefined,
        layer.id,
      ).toBeOneOf(allowed);
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
    const { biome, ...base } = COLORS;
    const markers = new Set([...Object.values(base), ...Object.values(biome)]);
    const used = new Set<string>();
    // A match expression mixes operators and habitat names with its colors: those are not colors
    const notColors = new Set(["match", "get", "habitat", ...Object.keys(biome)]);
    JSON.stringify(style, (key, value: unknown) => {
      if (/color$/.test(key)) {
        const values = Array.isArray(value) ? value.flat(Infinity) : [value];
        for (const v of values) if (!notColors.has(String(v))) used.add(String(v));
      }
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
      for (const font of fonts as string[])
        expect(served, layer.id).toContain(font);
    }
  });
});

describe("sky and projection", () => {
  // MapLibre's default sky is light blue with a white horizon; any sky the globe morph exposes must stay dark
  it("paints the sky with the space color", () => {
    expect(style.sky?.["sky-color"]).toBe(COLORS.space);
    expect(style.sky?.["horizon-color"]).toBe(COLORS.space);
  });

  // Its color is fixed in MapLibre's shader; the globe's edge is a rim line of our own (see globe-rim)
  it("turns MapLibre's atmosphere halo off", () => {
    expect(style.sky?.["atmosphere-blend"]).toBe(0);
  });

  // The water polygons end on the antimeridian, and their outline would cross the opening globe and the morph.
  // The final frame never goes below MIN_ZOOM, so the map at rest keeps its coastline
  it("draws the coastline only from the lowest final zoom", () => {
    expect(layers.find((l) => l.id === "coastline")?.minzoom).toBe(MIN_ZOOM);
  });

  it("is flat unless a projection is given", () => {
    expect(style.projection).toBeUndefined();
    expect(buildStyle(COLORS, HABITATS, SIGHTINGS, INTRO_PROJECTION).projection).toEqual(INTRO_PROJECTION);
  });
});

describe("habitat layers", () => {
  const index = (id: string) => layers.findIndex((l) => l.id === id);
  const land = layers.find((l) => l.id === "habitats");
  const sea = layers.find((l) => l.id === "habitat-sea");

  it("feeds the given habitats through a GeoJSON source", () => {
    expect(style.sources.habitats).toEqual({ type: "geojson", data: HABITATS });
  });

  it("paints land habitats over the land and under the water", () => {
    expect(land?.type).toBe("fill");
    expect(index("habitats")).toBeGreaterThan(index("background"));
    expect(index("habitats")).toBeLessThan(index("water"));
  });

  // The shelf sea sits on the base water, still under the coastline, borders and labels
  it("paints the sea habitat over the water and under the coastline", () => {
    expect(sea?.type).toBe("fill");
    expect(index("habitat-sea")).toBeGreaterThan(index("water"));
    expect(index("habitat-sea")).toBeLessThan(index("coastline"));
  });

  it.each(["habitats", "habitat-sea"])("%s is muted to the shared biome opacity", (id) => {
    const layer = layers.find((l) => l.id === id);
    if (layer?.type !== "fill") throw new Error(`missing fill layer ${id}`);
    expect(layer.paint?.["fill-opacity"]).toBe(BIOME_OPACITY);
  });

  it("colors each habitat with its biome token", () => {
    if (land?.type !== "fill") throw new Error("missing habitats fill");
    const color = land.paint?.["fill-color"];
    expect(color).toEqual([
      "match",
      ["get", "habitat"],
      "forest", "marker-forest",
      "grassland", "marker-grassland",
      "waters-edge", "marker-waters-edge",
      "mountain", "marker-mountain",
      "rough-terrain", "marker-rough-terrain",
      "sea", "marker-sea-habitat",
      "marker-land",
    ]);
    if (sea?.type !== "fill") throw new Error("missing sea fill");
    expect(sea.paint?.["fill-color"]).toEqual(color);
  });

  it("splits sea from land by the habitat property", () => {
    expect(land && "filter" in land ? land.filter : undefined).toEqual(["!=", ["get", "habitat"], "sea"]);
    expect(sea && "filter" in sea ? sea.filter : undefined).toEqual(["==", ["get", "habitat"], "sea"]);
  });
});

describe("Malvinas label", () => {
  // OpenMapTiles carries the archipelago as a country place with iso_a2 FK
  const islands = layers.find((l) => l.id === "place-island");

  it("labels the archipelago from the tile's own place", () => {
    expect(islands?.type).toBe("symbol");
    expect(
      islands && "source-layer" in islands
        ? islands["source-layer"]
        : undefined,
    ).toBe("place");
    expect(islands && "filter" in islands ? islands.filter : undefined).toEqual(
      [
        "all",
        ["==", ["get", "class"], "country"],
        ["==", ["get", "iso_a2"], "FK"],
      ],
    );
  });

  it("reads the Spanish name with the served italic font", () => {
    if (islands?.type !== "symbol")
      throw new Error("missing place-island symbol layer");
    expect(islands.layout?.["text-field"]).toEqual([
      "coalesce",
      ["get", "name:es"],
      ["get", "name"],
    ]);
    expect(islands.layout?.["text-font"]).toEqual(["Noto Sans Italic"]);
  });
});

describe("Argentina-only filters", () => {
  const within = ["within", ARGENTINA_OUTLINE];
  const usesOutline = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    const filter = layer && "filter" in layer ? layer.filter : undefined;
    return (JSON.stringify(filter) ?? "").includes(JSON.stringify(within));
  };

  it.each(["place-province", "place-city", "boundary-province"])(
    "%s keeps only features inside the outline",
    (id) => {
      expect(usesOutline(id)).toBe(true);
    },
  );

  it.each([
    "water-name",
    "boundary-country",
    "place-island",
    "coastline",
    "waterway",
  ])("%s stays global", (id) => {
    expect(usesOutline(id)).toBe(false);
  });
});

describe("ARGENTINA_OUTLINE", () => {
  // Plain even-odd ray cast over every ring
  const inside = (lng: number, lat: number) => {
    let hit = false;
    for (const polygon of ARGENTINA_OUTLINE.coordinates) {
      for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
          )
            hit = !hit;
        }
      }
    }
    return hit;
  };

  it("is a MultiPolygon within the country's bounding box", () => {
    expect(ARGENTINA_OUTLINE.type).toBe("MultiPolygon");
    for (const [lng, lat] of ARGENTINA_OUTLINE.coordinates.flat(2)) {
      expect(lng).toBeGreaterThanOrEqual(-74);
      expect(lng).toBeLessThanOrEqual(-53);
      expect(lat).toBeGreaterThanOrEqual(-56);
      expect(lat).toBeLessThanOrEqual(-21);
    }
  });

  it.each([
    ["Córdoba", -64.18, -31.42],
    ["Ushuaia", -68.3, -54.8],
    ["Posadas", -55.89, -27.37],
    ["Mendoza", -68.84, -32.89],
  ])("contains %s", (_name, lng, lat) => {
    expect(inside(lng, lat)).toBe(true);
  });

  it.each([
    ["Santiago de Chile", -70.65, -33.45],
    ["Montevideo", -56.16, -34.9],
    ["Asunción", -57.58, -25.26],
  ])("excludes %s", (_name, lng, lat) => {
    expect(inside(lng, lat)).toBe(false);
  });
});

describe("sightings layer", () => {
  const index = (id: string) => layers.findIndex((l) => l.id === id);
  const layer = layers.find((l) => l.id === "sightings");

  it("feeds each sighting as a point with its species id", () => {
    expect(style.sources.sightings).toEqual({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { speciesId: 25 }, geometry: { type: "Point", coordinates: [-58.4, -34.6] } },
          { type: "Feature", properties: { speciesId: 7 }, geometry: { type: "Point", coordinates: [-60.1, -45.2] } },
        ],
      },
    });
  });

  it("draws faint 2 px dots in the muted color, only from zoom 5", () => {
    if (layer?.type !== "circle") throw new Error("missing sightings circle layer");
    expect(layer.minzoom).toBe(5);
    expect(layer.paint).toEqual({
      "circle-radius": 2,
      "circle-color": "marker-sighting",
      "circle-opacity": 0.5,
    });
  });

  it("sits over the habitats and borders, under every label", () => {
    expect(index("sightings")).toBeGreaterThan(index("boundary-country"));
    const firstLabel = layers.findIndex((l) => l.type === "symbol");
    expect(index("sightings")).toBeLessThan(firstLabel);
  });

  // The source is always there so sightings that stream in later only need setData
  it("starts with an empty source when there are no sightings yet", () => {
    const empty = buildStyle(COLORS, HABITATS);
    expect(empty.sources.sightings).toEqual({ type: "geojson", data: { type: "FeatureCollection", features: [] } });
  });
});
