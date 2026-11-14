import { cacheLife } from "next/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FENCES } from "@/data/fences";
import { SITES } from "@/data/sites";
import { pointInPolygon } from "@/domain/geometry/point-in-polygon";
import { detect } from "@/domain/sightings/detect";
import { MAX_SITE_OFFSET } from "@/domain/sightings/distribute";
import type { Sighting } from "@/domain/sightings/types";
import habitatsFixture from "@/features/catalog/__fixtures__/habitats.json";
import { loadCatalog } from "@/features/catalog/queries";
import type { Catalog, Habitat } from "@/features/catalog/types";
import { loadSightings } from "./queries";
import { HABITAT_AREAS } from "./territory";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/features/catalog/queries", () => ({ loadCatalog: vi.fn() }));

// The real 386 species with their habitats, as PokéAPI lists them (trimmed fixture of the 06)
const CATALOG: Catalog = habitatsFixture
  .flatMap((h) =>
    h.pokemon_species.map((s) => ({
      id: Number(/\/(\d+)\/$/.exec(s.url)![1]),
      slug: s.name,
      habitat: h.name as Habitat,
      types: ["normal" as const],
    })),
  )
  .sort((a, b) => a.id - b.id);

const habitatOf = new Map(CATALOG.map((s) => [s.id, s.habitat]));

async function sightings(): Promise<Sighting[]> {
  const loaded = await loadSightings();
  if (!loaded.ok) throw new Error(`expected data, got ${loaded.kind}`);
  return loaded.data;
}

beforeEach(() => {
  vi.mocked(cacheLife).mockClear();
  vi.mocked(loadCatalog).mockResolvedValue({ ok: true, data: CATALOG });
});

describe("loadSightings", () => {
  test("spreads the real catalog over the real habitats and sites, cached for days", async () => {
    const data = await sightings();
    expect(CATALOG).toHaveLength(386);
    expect(new Set(data.map((s) => s.speciesId)).size).toBe(386);
    expect(cacheLife).toHaveBeenCalledWith("days");
  });

  test("every point falls in its habitat: an area polygon or near a curated site", async () => {
    for (const { speciesId, point } of await sightings()) {
      const habitat = habitatOf.get(speciesId)!;
      const inArea = HABITAT_AREAS.some(
        (a) => a.habitat === habitat && a.polygons.some((polygon) => pointInPolygon(point, polygon)),
      );
      const nearSite = SITES.some(
        (s) => s.habitat === habitat && Math.hypot(point[0] - s.point[0], point[1] - s.point[1]) <= MAX_SITE_OFFSET,
      );
      expect(inArea || nearSite, `${speciesId} (${habitat}) at ${point}`).toBe(true);
    }
  });

  // Pinned on purpose: a change in the spread or in the data must show up here
  test("pins the total and the detection of the preset fences", async () => {
    const data = await sightings();
    const detections = Object.fromEntries(
      FENCES.map((fence) => {
        const { traced, weakSignals } = detect(fence, data);
        return [fence.id, [traced.length, weakSignals]];
      }),
    );
    expect({ total: data.length, detections }).toMatchInlineSnapshot(`
      {
        "detections": {
          "ibera": [
            12,
            36,
          ],
          "misiones": [
            12,
            33,
          ],
          "monte": [
            12,
            2,
          ],
          "pampa": [
            12,
            25,
          ],
          "patagonia": [
            12,
            21,
          ],
          "puna": [
            12,
            23,
          ],
          "sea": [
            7,
            0,
          ],
          "yungas": [
            12,
            30,
          ],
        },
        "total": 1758,
      }
    `);
  });

  test("a failed catalog is a failure kept only briefly, with no sightings", async () => {
    vi.mocked(loadCatalog).mockResolvedValue({ ok: false, kind: "unavailable" });
    expect(await loadSightings()).toEqual({ ok: false, kind: "unavailable" });
    expect(cacheLife).toHaveBeenCalledWith("seconds");
  });
});
