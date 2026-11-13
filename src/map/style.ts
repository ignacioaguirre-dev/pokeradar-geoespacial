import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import { ARGENTINA_OUTLINE } from "./argentina-outline";
import type { MapColors } from "./colors";

const SOURCE = "openmaptiles";
const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:es"],
  ["get", "name"],
];
// Maritime boundaries would draw lines across the sea
// OpenMapTiles places and boundaries have no country attribute, so keep only those inside Argentina
const IN_ARGENTINA: ExpressionSpecification = ["within", ARGENTINA_OUTLINE];
const ON_LAND: ExpressionSpecification = ["!=", ["get", "maritime"], 1];

export function buildStyle(colors: MapColors): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": colors.land },
      },
      {
        id: "water",
        type: "fill",
        source: SOURCE,
        "source-layer": "water",
        paint: { "fill-color": colors.sea },
      },
      {
        id: "coastline",
        type: "line",
        source: SOURCE,
        "source-layer": "water",
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
