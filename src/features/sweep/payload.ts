import { toCompact } from "@/domain/sightings/compact";
import type { Sighting } from "@/domain/sightings/types";
import type { Catalog } from "@/features/catalog/types";
import type { SightingsPayload } from "./types";

// What the page streams for the sweep. The client names species n with slugs[n - 1], so the catalog
// must run 1..N without gaps; otherwise null (the sweep says it could not load) rather than wrong names
export function sweepPayload(sightings: readonly Sighting[], catalog: Catalog): SightingsPayload | null {
  if (!catalog.every((species, i) => species.id === i + 1)) return null;
  return { sightings: toCompact(sightings), slugs: catalog.map((species) => species.slug) };
}
