import type { ExpressionSpecification, ProjectionSpecification, StyleSpecification } from "maplibre-gl";
import { BIOME_OPACITY } from "@/domain/color/biome";
import { ARGENTINA_OUTLINE } from "@/domain/geography/argentina-outline";
import type { MapColors } from "./colors";
import type { CompactSighting } from "@/domain/sightings/compact";
import type { HabitatCollection } from "./habitats";
import { MIN_ZOOM } from "./argentina";
import {
  SIGHTING_MIN_ZOOM,
  SIGHTING_OPACITY,
  SIGHTING_RADIUS,
  SIGHTINGS_SOURCE,
  toSightingCollection,
} from "./sightings";

const SOURCE = "openmaptiles";
const HABITATS = "habitats";
const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:es"],
  ["get", "name"],
];
// Maritime boundaries would draw lines across the sea
// OpenMapTiles places and boundaries have no country attribute, so keep only those inside Argentina
const IN_ARGENTINA: ExpressionSpecification = ["within", ARGENTINA_OUTLINE];
const ON_LAND: ExpressionSpecification = ["!=", ["get", "maritime"], 1];

function habitatColor({ biome, land }: MapColors): ExpressionSpecification {
  return [
    "match",
    ["get", "habitat"],
    "forest", biome.forest,
    "grassland", biome.grassland,
    "waters-edge", biome["waters-edge"],
    "mountain", biome.mountain,
    "rough-terrain", biome["rough-terrain"],
    "sea", biome.sea,
    land,
  ];
}

export function buildStyle(
  colors: MapColors,
  habitats: HabitatCollection,
  sightings: readonly CompactSighting[] = [],
  // Only the entry flight passes one; without it the map is plain mercator
  projection?: ProjectionSpecification,
): StyleSpecification {
  const habitatPaint = { "fill-color": habitatColor(colors), "fill-opacity": BIOME_OPACITY };
  return {
    version: 8,
    sources: {
      [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      [HABITATS]: { type: "geojson", data: habitats },
      // Always present, even empty: sightings that stream in later only need setData
      [SIGHTINGS_SOURCE]: { type: "geojson", data: toSightingCollection(sightings) },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    ...(projection ? { projection } : {}),
    // The default sky is light blue with a white horizon: whatever sky the globe exposes stays space-dark
    sky: {
      "sky-color": colors.space,
      "horizon-color": colors.space,
      // Its halo's color is fixed in MapLibre's shader; the flight draws the globe's edge as a line instead
      "atmosphere-blend": 0,
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": colors.land },
      },
      {
        // Under the water layer, so OSM lakes and rivers still cut through the ecoregions
        id: "habitats",
        type: "fill",
        source: HABITATS,
        filter: ["!=", ["get", "habitat"], "sea"],
        paint: habitatPaint,
      },
      {
        id: "water",
        type: "fill",
        source: SOURCE,
        "source-layer": "water",
        paint: { "fill-color": colors.sea },
      },
      {
        // The shelf sea tints the base ocean; the coastline still draws over it
        id: "habitat-sea",
        type: "fill",
        source: HABITATS,
        filter: ["==", ["get", "habitat"], "sea"],
        paint: habitatPaint,
      },
      {
        id: "coastline",
        type: "line",
        source: SOURCE,
        "source-layer": "water",
        // The water polygons end on the antimeridian, a line across the opening globe; at rest the zoom never goes lower
        minzoom: MIN_ZOOM,
        paint: { "line-color": colors.coast, "line-width": 1 },
      },
      {
        id: "waterway",
        type: "line",
        source: SOURCE,
        "source-layer": "waterway",
        minzoom: 5,
        filter: ["==", ["get", "class"], "river"],
        paint: { "line-color": colors.sea },
      },
      {
        id: "boundary-province",
        type: "line",
        source: SOURCE,
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 4],
          ON_LAND,
          IN_ARGENTINA,
        ],
        paint: { "line-color": colors.province, "line-dasharray": [3, 2] },
      },
      {
        id: "boundary-country",
        type: "line",
        source: SOURCE,
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ON_LAND],
        paint: { "line-color": colors.border, "line-width": 1.2 },
      },
      {
        // Over the biomes and borders so the dots read, under the labels so names stay legible
        id: SIGHTINGS_SOURCE,
        type: "circle",
        source: SIGHTINGS_SOURCE,
        minzoom: SIGHTING_MIN_ZOOM,
        paint: {
          "circle-radius": SIGHTING_RADIUS,
          "circle-color": colors.sighting,
          "circle-opacity": SIGHTING_OPACITY,
        },
      },
      {
        id: "water-name",
        type: "symbol",
        source: SOURCE,
        "source-layer": "water_name",
        layout: {
          "text-field": NAME,
          "text-font": ["Noto Sans Italic"],
          "text-size": 12,
        },
        paint: { "text-color": colors.label },
      },
      {
        id: "place-province",
        type: "symbol",
        source: SOURCE,
        "source-layer": "place",
        filter: ["all", ["==", ["get", "class"], "state"], IN_ARGENTINA],
        layout: {
          "text-field": NAME,
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.12,
        },
        paint: { "text-color": colors.label },
      },
      {
        id: "place-city",
        type: "symbol",
        source: SOURCE,
        "source-layer": "place",
        // Missing ranks count as minor so the comparison never sees null
        filter: [
          "all",
          ["==", ["get", "class"], "city"],
          ["<=", ["coalesce", ["get", "rank"], 99], 6],
          IN_ARGENTINA,
        ],
        layout: {
          "text-field": NAME,
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: { "text-color": colors.city },
      },
      {
        // OpenMapTiles carries the archipelago as a country place; last so its label wins placement
        id: "place-island",
        type: "symbol",
        source: SOURCE,
        "source-layer": "place",
        filter: [
          "all",
          ["==", ["get", "class"], "country"],
          ["==", ["get", "iso_a2"], "FK"],
        ],
        layout: {
          "text-field": NAME,
          "text-font": ["Noto Sans Italic"],
          "text-size": 12,
        },
        paint: { "text-color": colors.label },
      },
    ],
  };
}
