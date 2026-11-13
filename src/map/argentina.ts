import type { LngLatBoundsLike } from "maplibre-gl";

// Mainland Argentina, from the Andes to the Atlantic and from Tierra del Fuego to the Puna
export const ARGENTINA_BOUNDS: LngLatBoundsLike = [
  [-73.6, -55.2],
  [-53.5, -21.7],
];

// Room to pan around the country without drifting off into empty ocean
export const MAX_BOUNDS: LngLatBoundsLike = [
  [-95, -62],
  [-30, -10],
];

export const MIN_ZOOM = 2;
