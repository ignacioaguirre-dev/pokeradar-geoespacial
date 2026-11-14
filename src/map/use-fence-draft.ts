"use client";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { type RefObject, useEffect, useEffectEvent } from "react";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { draftCollection, FENCE_DRAFT } from "./fence-draft";
import { listenForTaps } from "./tap-input";

export type FenceDraftProps = {
  // The vertices placed so far, in order
  ring: Ring;
  // A tap, or Enter under the reticle; whether it becomes a vertex is the caller's rule
  onPoint(point: LngLat): void;
};

const NO_VERTICES: Ring = [];

// The reticle marks the map's center: the middle of what the panels leave free, where the arrows move
export function reticlePoint(map: MapLibreMap): LngLat {
  const { lng, lat } = map.getCenter();
  return [lng, lat];
}

// Draws the fence being traced and turns taps (not drags, not pinches) and Enter into points.
// null until the style has loaded, as the draft source lives in it
export function useFenceDraft(
  map: MapLibreMap | null,
  draft: FenceDraftProps | null | undefined,
  reticle: RefObject<Element | null>,
): void {
  const active = Boolean(draft);
  const ring = draft?.ring ?? NO_VERTICES;
  const point = useEffectEvent((p: LngLat) => draft?.onPoint(p));

  useEffect(() => {
    map?.getSource<GeoJSONSource>(FENCE_DRAFT)?.setData(draftCollection(ring));
  }, [map, ring]);

  useEffect(() => {
    if (!map || !active) return;
    const canvas = map.getCanvas();
    const container = map.getContainer();
    // Two quick taps are two vertices, not a zoom
    map.doubleClickZoom.disable();
    container.setAttribute("data-drawing", "");
    // The center moves on screen when a camera changes the padding (the sweep, the detail)
    const placeReticle = () => {
      const { x, y } = map.project(map.getCenter());
      // Hidden until placed, so it never shows at the corner first
      reticle.current?.setAttribute("style", `translate: ${x}px ${y}px; visibility: visible`);
    };
    placeReticle();
    map.on("move", placeReticle);
    const stopTaps = listenForTaps(map.getCanvasContainer(), canvas, (x, y) => {
      const { lng, lat } = map.unproject([x, y]);
      point([lng, lat]);
    });
    // The arrows already move the map under the reticle
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;
      event.preventDefault();
      point(reticlePoint(map));
    };
    canvas.addEventListener("keydown", onKey);
    return () => {
      map.off("move", placeReticle);
      stopTaps();
      canvas.removeEventListener("keydown", onKey);
      container.removeAttribute("data-drawing");
      map.doubleClickZoom.enable();
    };
  }, [map, active, reticle]);
}
