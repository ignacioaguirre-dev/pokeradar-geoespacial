export type LngLat = readonly [lng: number, lat: number];

// Open ring: the last vertex does not repeat the first one.
export type Ring = readonly LngLat[];

export type BBox = readonly [west: number, south: number, east: number, north: number];

// The visible name lives in the UI catalog (next-intl), not here.
export type Fence = { readonly id: string; readonly ring: Ring };
