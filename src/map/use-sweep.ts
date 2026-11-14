"use client";

import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { useEffect, useEffectEvent } from "react";
import { parseDuration } from "@/hooks/use-duration-token";
import { readMapColors } from "./colors";
import type { SweepCreature } from "./sweep-markers";
import { cubicBezier, parseCurve } from "./sweep-motion";
import { clearSweep, runSweep, type SweepFence } from "./sweep";

export type { SweepCreature, SweepFence };

export type SweepProps = {
  fence: SweepFence | null;
  // Same identity for the same detection, or the sweep replays
  creatures: readonly SweepCreature[];
  // The creature whose detail is open: the camera flies to it when it is one of the traced
  focus: number | null;
  // Read when the camera moves: they depend on the layout at that moment (detail open, sheet height)
  fencePadding(): PaddingOptions;
  detailPadding(): PaddingOptions;
  onSelect(id: number): void;
  onIntent(id: number): void;
};

// Close enough to see the creature among its neighbors, never zooming out from where the user is
const CREATURE_ZOOM = 7;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Script-driven motion follows the same tokens as CSS; the stylesheet zeroes the duration under reduced motion
function readTiming() {
  const css = getComputedStyle(document.documentElement);
  const curve = parseCurve(css.getPropertyValue("--curve-out"));
  return {
    durationMs: reducedMotion() ? 0 : parseDuration(css.getPropertyValue("--duration-sweep")),
    ease: curve ? cubicBezier(curve) : (t: number) => t,
  };
}

const NO_CREATURES: readonly SweepCreature[] = [];
const NO_PADDING: PaddingOptions = { top: 0, right: 0, bottom: 0, left: 0 };

// Draws the sweep on a loaded map; null until the style has loaded, as the sweep sources live in it
export function useSweep(map: MapLibreMap | null, sweep: SweepProps | undefined): void {
  const fence = sweep?.fence ?? null;
  const creatures = sweep?.creatures ?? NO_CREATURES;
  const focus = sweep?.focus ?? null;

  const select = useEffectEvent((id: number) => sweep?.onSelect(id));
  const intent = useEffectEvent((id: number) => sweep?.onIntent(id));

  // A fence only comes with the sweep props, so they are there whenever this runs
  const start = useEffectEvent((map: MapLibreMap, fence: SweepFence) =>
    runSweep(map, {
      fence,
      creatures,
      padding: sweep?.fencePadding() ?? NO_PADDING,
      ...readTiming(),
      traceColor: readMapColors().trace,
      onSelect: select,
      onIntent: intent,
    }),
  );

  // Cancelling on change and on unmount never touches the sources: on unmount the map is already gone
  useEffect(() => {
    if (!map) return;
    if (!fence) {
      clearSweep(map);
      return;
    }
    return start(map, fence);
  }, [map, fence, creatures]);

  const fly = useEffectEvent((map: MapLibreMap, id: number) => {
    const creature = creatures.find((c) => c.id === id);
    if (!creature || !sweep) return;
    const camera = {
      center: [creature.point[0], creature.point[1]] as [number, number],
      zoom: Math.max(map.getZoom(), CREATURE_ZOOM),
      padding: sweep.detailPadding(),
    };
    if (reducedMotion()) map.jumpTo(camera);
    else map.flyTo(camera);
  });

  useEffect(() => {
    if (map && focus !== null) fly(map, focus);
  }, [map, focus]);
}
