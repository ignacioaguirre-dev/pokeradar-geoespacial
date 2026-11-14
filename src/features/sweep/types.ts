import type { LngLat } from "@/domain/geometry/types";
import type { CompactSighting } from "@/domain/sightings/compact";

// What the page streams to the client for the sweep: every sighting, and the slugs to name them
export type SightingsPayload = {
  readonly sightings: readonly CompactSighting[];
  // Indexed by species id - 1: 386 short strings weigh less than an id on each one
  readonly slugs: readonly string[];
};

export type TracedCreature = { readonly id: number; readonly name: string; readonly point: LngLat };

export type FenceDetection =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly traced: readonly TracedCreature[]; readonly weakSignals: number };
