import type { Map as MapLibreMap, ProjectionSpecification } from "maplibre-gl";
import { MIN_ZOOM } from "./argentina";
import { attachGlobeRim, type RimMap } from "./globe-rim";

export const INTRO_DURATION_MS = 3_500;
// The start view never zooms past it, so the flight opens on a whole sphere
export const MAX_START_ZOOM = 1.2;
// The morph ends just under the final zoom, so the landing is plain mercator on every screen. Late in the descent,
// the far side of the world it drags across the screen is already beyond the edges
const FLAT_BELOW_FINAL = 0.1;
const MORPH_SPAN = 0.3;
// South America centered, with Argentina in the lower half of the sphere
export const INTRO_CENTER: [number, number] = [-60, -20];
// Share of the shorter side the globe fills at the start
const GLOBE_SHARE = 0.7;
// MapLibre's world is 512 px wide at zoom 0
const WORLD_PX = 512;

export function introProjection(finalZoom: number): ProjectionSpecification {
  const flatFrom = finalZoom - FLAT_BELOW_FINAL;
  const globeUntil = Math.max(flatFrom - MORPH_SPAN, MAX_START_ZOOM);
  return { type: ["interpolate", ["linear"], ["zoom"], globeUntil, "vertical-perspective", flatFrom, "mercator"] };
}

// What the style starts with: a morphing globe. The flight swaps in the one for this screen before anything shows
export const INTRO_PROJECTION = introProjection(MIN_ZOOM);

const MERCATOR: ProjectionSpecification = { type: "mercator" };
const INTERACTIONS = ["mousedown", "touchstart", "wheel", "keydown"] as const;

export type IntroMap = Pick<
  MapLibreMap,
  | "getCenter"
  | "getZoom"
  | "getMinZoom"
  | "getMaxBounds"
  | "setMinZoom"
  | "setMaxBounds"
  | "setProjection"
  | "jumpTo"
  | "easeTo"
  | "stop"
  | "loaded"
  | "getContainer"
  | "getCanvas"
  | "on"
  | "off"
> &
  RimMap;

export type IntroFlight = {
  // Ends the flight now, on the final frame with the limits applied
  cancel(): void;
  // Detaches without touching the map, for when it is about to be removed
  dispose(): void;
};

type IntroOptions = {
  width: number;
  height: number;
  rimColor: string;
  onEnd(): void;
};

// Globe diameter is worldSize / π, so this zoom makes it GLOBE_SHARE of the shorter side
export function introStartZoom(width: number, height: number): number {
  const zoom = Math.log2((GLOBE_SHARE * Math.min(width, height) * Math.PI) / WORLD_PX);
  return Math.min(Math.max(zoom, 0), MAX_START_ZOOM);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Call right after creating the map, before its style loads: the map must already sit on the final frame
 * (bounds, padding and limits applied) and its style must carry INTRO_PROJECTION.
 */
export function startIntroFlight(map: IntroMap, { width, height, rimColor, onEnd }: IntroOptions): IntroFlight {
  const final = { center: map.getCenter(), zoom: map.getZoom() };
  const limits = { minZoom: map.getMinZoom(), maxBounds: map.getMaxBounds() };
  const container = map.getContainer();
  const canvas = map.getCanvas();
  let done = false;
  let pending: ProjectionSpecification | null = null;
  let rim: { remove(): void } | null = null;

  // Until the style is parsed MapLibre throws; the latest projection asked for applies as soon as it is
  function setProjection(projection: ProjectionSpecification) {
    try {
      map.setProjection(projection);
    } catch {
      if (!pending) map.on("style.load", applyPending);
      pending = projection;
    }
  }
  function applyPending() {
    map.off("style.load", applyPending);
    if (pending) map.setProjection(pending);
    pending = null;
  }

  function removeRim() {
    rim?.remove();
    rim = null;
  }

  function reveal() {
    canvas.style.visibility = "";
  }

  function detach() {
    for (const type of INTERACTIONS) container.removeEventListener(type, finish, true);
    map.off("load", fly);
    map.off("moveend", finish);
  }

  function finish() {
    if (done) return;
    done = true;
    detach();
    removeRim();
    reveal();
    map.stop();
    // Flat first, so the final jump runs on the same mercator camera as a plain load
    setProjection(MERCATOR);
    map.setMaxBounds(limits.maxBounds);
    map.setMinZoom(limits.minZoom);
    map.jumpTo(final);
    onEnd();
  }

  function fly() {
    map.off("load", fly);
    reveal();
    rim = attachGlobeRim(map, rimColor);
    // Registered before easeTo: MapLibre ends a non-essential animation at once under reduced motion
    map.on("moveend", finish);
    map.easeTo({ ...final, duration: INTRO_DURATION_MS, easing: easeInOutCubic });
  }

  // The start view lies outside the navigation limits, so they wait for the end
  map.setMaxBounds(null);
  map.setMinZoom(0);
  map.jumpTo({ center: INTRO_CENTER, zoom: introStartZoom(width, height) });
  setProjection(introProjection(final.zoom));
  // Until its tiles arrive the globe is a bare disk of the land color; space shows instead
  canvas.style.visibility = "hidden";
  // Capture, so the skip lands before MapLibre's own handlers act on the same event
  for (const type of INTERACTIONS) container.addEventListener(type, finish, { capture: true, passive: true });
  if (map.loaded()) fly();
  else map.on("load", fly);

  return {
    cancel: finish,
    dispose() {
      done = true;
      detach();
      removeRim();
      reveal();
      map.off("style.load", applyPending);
    },
  };
}
