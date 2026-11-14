"use client";

import { useMemo, useState } from "react";
import type { Fence } from "@/domain/geometry/types";
import { fromCompact } from "@/domain/sightings/compact";
import { detect } from "@/domain/sightings/detect";
import type { FenceDetection, SightingsPayload } from "./types";

const IDLE: FenceDetection = { status: "idle" };
const LOADING: FenceDetection = { status: "loading" };
const UNAVAILABLE: FenceDetection = { status: "unavailable" };

// Stand-in until the detail brings the localized name: Gen I–III names read the same in Spanish
export function displayName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// The chosen fence and what it detects. Runs on the client over the sightings the page already sent.
// payload: undefined while it streams, null when the catalog failed
export function useFenceSweep<F extends Fence>(fences: readonly F[], payload: SightingsPayload | null | undefined) {
  const [fenceId, setFenceId] = useState<string | null>(null);
  const fence = fences.find((f) => f.id === fenceId) ?? null;

  // Decoded once per payload, not per fence
  const sightings = useMemo(() => (payload ? fromCompact(payload.sightings) : null), [payload]);

  const detection = useMemo((): FenceDetection => {
    if (!fence) return IDLE;
    if (payload === undefined) return LOADING;
    if (payload === null || !sightings) return UNAVAILABLE;
    const { traced, weakSignals } = detect(fence, sightings);
    return {
      status: "ready",
      weakSignals,
      traced: traced.map(({ speciesId, point }) => ({
        id: speciesId,
        name: displayName(payload.slugs[speciesId - 1] ?? String(speciesId)),
        point,
      })),
    };
  }, [fence, payload, sightings]);

  const choose = (id: string) => {
    if (fences.some((f) => f.id === id)) setFenceId(id);
  };

  return { fence, detection, choose };
}
