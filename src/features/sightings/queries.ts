import "server-only";
import { distribute } from "@/domain/sightings/distribute";
import type { Sighting } from "@/domain/sightings/types";
import { loadCatalog } from "@/features/catalog/queries";
import { cacheFor, type Loaded } from "@/lib/upstream/result";
import { HABITAT_AREAS, SIGHTING_SITES } from "./territory";

// Same input, same spread: cached for as long as the catalog, recomputed only when it is.
// No settle: loadCatalog already returns its failure as a value, and distribute does not throw.
export async function loadSightings(): Promise<Loaded<Sighting[]>> {
  "use cache";
  const catalog = await loadCatalog();
  const loaded: Loaded<Sighting[]> = catalog.ok
    ? { ok: true, data: distribute(catalog.data, HABITAT_AREAS, SIGHTING_SITES) }
    : catalog;
  cacheFor(loaded, "days");
  return loaded;
}
