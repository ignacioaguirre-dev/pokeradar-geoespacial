import type { Sighting } from "./types";

// Wire format for the client: ~1 700 tuples weigh a fraction of the same objects with keys.
export type CompactSighting = readonly [speciesId: number, lng: number, lat: number];

export function toCompact(sightings: readonly Sighting[]): CompactSighting[] {
  return sightings.map(({ speciesId, point: [lng, lat] }) => [speciesId, lng, lat]);
}

export function fromCompact(compact: readonly CompactSighting[]): Sighting[] {
  return compact.map(([speciesId, lng, lat]) => ({ speciesId, point: [lng, lat] }));
}
