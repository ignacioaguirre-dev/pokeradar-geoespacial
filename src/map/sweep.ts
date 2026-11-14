import type { GeoJSONSource, Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { bbox } from "@/domain/geometry/bbox";
import { centroid } from "@/domain/geometry/centroid";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { trace } from "@/domain/sightings/trace";
import { addMarkers, type SweepCreature } from "./sweep-markers";
import { ringRadius, sweepFrame, traceGradient, worldRadius, type SweepFrame } from "./sweep-motion";
import { RING_LAYERS, SWEEP_FENCE, SWEEP_RINGS, SWEEP_TRACES } from "./sweep-style";

export type SweepFence = { readonly id: string; readonly ring: Ring };

type Options = {
  fence: SweepFence;
  creatures: readonly SweepCreature[];
  padding: PaddingOptions;
  // 0 under reduced motion: the camera jumps and the sweep is drawn complete
  durationMs: number;
  ease(t: number): number;
  traceColor: string;
  onSelect(id: number): void;
  onIntent(id: number): void;
};

const EMPTY = { type: "FeatureCollection", features: [] } as const;

// If the camera never reports the end of its move (a gesture took over), start anyway
const CAMERA_GRACE_MS = 250;

function setData(map: MapLibreMap, source: string, data: Parameters<GeoJSONSource["setData"]>[0]) {
  map.getSource<GeoJSONSource>(source)?.setData(data);
}

const closed = (ring: Ring): LngLat[] => [...ring, ring[0]];

export function clearSweep(map: MapLibreMap): void {
  for (const source of [SWEEP_FENCE, SWEEP_RINGS, SWEEP_TRACES]) setData(map, source, EMPTY);
}

// Frames the fence, then plays the event once: rings out from the center, traces to each creature,
// markers where they land. Returns the cancel, which stops the frames and takes the markers away
export function runSweep(map: MapLibreMap, options: Options): () => void {
  const { fence, creatures, padding, durationMs, ease, traceColor } = options;
  const center = centroid(fence.ring);
  const reach = worldRadius(center, fence.ring);

  setData(map, SWEEP_FENCE, {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: closed(fence.ring).map(([lng, lat]) => [lng, lat]) },
  });
  setData(map, SWEEP_RINGS, {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [center[0], center[1]] },
  });
  setData(map, SWEEP_TRACES, {
    type: "FeatureCollection",
    features: creatures.map((creature) => ({
      type: "Feature",
      properties: { id: creature.id },
      geometry: { type: "LineString", coordinates: trace(center, creature.point).map(([lng, lat]) => [lng, lat]) },
    })),
  });

  const paint = (frame: SweepFrame) => {
    frame.rings.forEach(({ scale, opacity }, i) => {
      map.setPaintProperty(RING_LAYERS[i], "circle-radius", ringRadius(reach, scale));
      map.setPaintProperty(RING_LAYERS[i], "circle-stroke-opacity", opacity);
    });
    map.setPaintProperty(SWEEP_TRACES, "line-gradient", traceGradient(traceColor, frame.trace));
  };

  let markers: ReturnType<typeof addMarkers> = [];
  const land = () => {
    markers = addMarkers(map, creatures, options);
  };

  const [west, south, east, north] = bbox(fence.ring);
  const animate = durationMs > 0;
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    // Absolute: the fence padding replaces the map's, so it never adds up with the base one
    { padding, absolutePadding: true, linear: true, duration: durationMs, animate },
  );

  if (!animate) {
    paint(sweepFrame(0, 0, ease));
    land();
    return () => markers.forEach((marker) => marker.remove());
  }

  // Hidden until the camera arrives: the event reads only once the fence is in view
  paint(sweepFrame(0, durationMs, ease));
  let frame = 0;
  let started = false;
  let cancelled = false;
  const tick = (start: number) => {
    const elapsed = performance.now() - start;
    const state = sweepFrame(elapsed, durationMs, ease);
    paint(state);
    if (state.done) {
      frame = 0;
      land();
      return;
    }
    frame = requestAnimationFrame(() => tick(start));
  };
  const begin = () => {
    if (started || cancelled) return;
    started = true;
    clearTimeout(grace);
    map.off("moveend", begin);
    const start = performance.now();
    frame = requestAnimationFrame(() => tick(start));
  };
  map.once("moveend", begin);
  const grace = setTimeout(begin, durationMs + CAMERA_GRACE_MS);

  return () => {
    cancelled = true;
    clearTimeout(grace);
    map.off("moveend", begin);
    if (frame) cancelAnimationFrame(frame);
    markers.forEach((marker) => marker.remove());
  };
}
