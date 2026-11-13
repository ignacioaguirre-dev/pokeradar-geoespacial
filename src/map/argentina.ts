import type { LngLatBoundsLike } from "maplibre-gl";

// Mainland Argentina, from the Andes to the Atlantic and from Tierra del Fuego to the Puna
export const ARGENTINA_BOUNDS: LngLatBoundsLike = [
  [-73.6, -55.2],
  [-53.5, -21.7],
];

// Wide Southern Cone: maxBounds clamps the zoom, so tighter limits crop the initial fit on tall screens (checked up to 1920×1080)
export const MAX_BOUNDS: LngLatBoundsLike = [
  [-125, -70],
  [0, 5],
];

export const MIN_ZOOM = 2;
