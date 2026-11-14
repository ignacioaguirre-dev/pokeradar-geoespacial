import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { MapColors } from "./colors";
import { RING_FRACTIONS, traceGradient } from "./sweep-motion";

export const SWEEP_FENCE = "sweep-fence";
export const SWEEP_RINGS = "sweep-rings";
export const SWEEP_TRACES = "sweep-traces";
export const RING_LAYERS = RING_FRACTIONS.map((_, i) => `sweep-ring-${i}`);

const FENCE_WIDTH = 2;
const RING_WIDTH = 1.5;
const TRACE_WIDTH = 2;

// The rings are set every frame; MapLibre's default 300 ms easing would trail each step behind the curve
const NO_TRANSITION = { duration: 0, delay: 0 };

const EMPTY = { type: "FeatureCollection", features: [] } as const;

// Empty until a fence is chosen; the sweep then only swaps data and paint
export function sweepSources(): Record<string, SourceSpecification> {
  return {
    [SWEEP_FENCE]: { type: "geojson", data: EMPTY },
    [SWEEP_RINGS]: { type: "geojson", data: EMPTY },
    // line-progress, which the gradient draws along, needs the line metrics
    [SWEEP_TRACES]: { type: "geojson", data: EMPTY, lineMetrics: true },
  };
}

// Rings under the fence, traces on top: the path to each creature is what the eye should follow
export function sweepLayers(colors: MapColors): LayerSpecification[] {
  return [
    ...RING_LAYERS.map(
      (id): LayerSpecification => ({
        id,
        type: "circle",
        source: SWEEP_RINGS,
        paint: {
          "circle-radius": 0,
          // Outline only: a filled disc would hide the biome under it
          "circle-opacity": 0,
          "circle-stroke-width": RING_WIDTH,
          "circle-stroke-color": colors.sweep,
          "circle-stroke-opacity": 0,
          "circle-radius-transition": NO_TRANSITION,
          "circle-stroke-opacity-transition": NO_TRANSITION,
        },
      }),
    ),
    {
      id: SWEEP_FENCE,
      type: "line",
      source: SWEEP_FENCE,
      layout: { "line-join": "round" },
      paint: { "line-color": colors.sweep, "line-width": FENCE_WIDTH },
    },
    {
      id: SWEEP_TRACES,
      type: "line",
      source: SWEEP_TRACES,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-width": TRACE_WIDTH, "line-gradient": traceGradient(colors.trace, 0) },
    },
  ];
}
