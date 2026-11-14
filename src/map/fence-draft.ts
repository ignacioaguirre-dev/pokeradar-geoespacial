import type { ExpressionSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { LngLat, Ring } from "@/domain/geometry/types";
import type { MapColors } from "./colors";

export const FENCE_DRAFT = "fence-draft";
export const DRAFT_LAYERS = ["fence-draft-edges", "fence-draft-closing", "fence-draft-vertices"] as const;

// Same width as the swept fence: the draft is the fence it will become
const EDGE_WIDTH = 2;
const VERTEX_RADIUS = 5;
// Dashes in line widths: the closing edge reads as the one still to come
const CLOSING_DASH = [2, 2];

type Part = "edge" | "closing" | "vertex";

const position = ([lng, lat]: LngLat) => [lng, lat];

const line = (part: Part, coordinates: readonly LngLat[]) => ({
  type: "Feature" as const,
  properties: { part },
  geometry: { type: "LineString" as const, coordinates: coordinates.map(position) },
});

// The open path as drawn, the edge that would close it, and a dot per vertex
export function draftCollection(ring: Ring) {
  const features = [];
  if (ring.length >= 2) features.push(line("edge", ring));
  // Two vertices have a single edge: closing it would only draw it again
  if (ring.length >= 3) features.push(line("closing", [ring[ring.length - 1], ring[0]]));
  for (const vertex of ring) {
    features.push({
      type: "Feature" as const,
      properties: { part: "vertex" as Part },
      geometry: { type: "Point" as const, coordinates: position(vertex) },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

export function draftSources(): Record<string, SourceSpecification> {
  return { [FENCE_DRAFT]: { type: "geojson", data: draftCollection([]) } };
}

const isPart = (part: Part): ExpressionSpecification => ["==", ["get", "part"], part];

// Over the sweep, which is cleared while drawing; flat, without halos, in the fence's own color
export function draftLayers(colors: MapColors): LayerSpecification[] {
  return [
    {
      id: DRAFT_LAYERS[0],
      type: "line",
      source: FENCE_DRAFT,
      filter: isPart("edge"),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": colors.sweep, "line-width": EDGE_WIDTH },
    },
    {
      id: DRAFT_LAYERS[1],
      type: "line",
      source: FENCE_DRAFT,
      filter: isPart("closing"),
      paint: { "line-color": colors.sweep, "line-width": EDGE_WIDTH, "line-dasharray": CLOSING_DASH },
    },
    {
      id: DRAFT_LAYERS[2],
      type: "circle",
      source: FENCE_DRAFT,
      filter: isPart("vertex"),
      paint: { "circle-radius": VERTEX_RADIUS, "circle-color": colors.sweep },
    },
  ];
}
