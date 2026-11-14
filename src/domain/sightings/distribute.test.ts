import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { pointInPolygon } from "@/domain/geometry/point-in-polygon";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { HABITATS, type Habitat } from "@/domain/habitat/types";
import { distribute, MAX_SITE_OFFSET } from "./distribute";
import type { HabitatArea, Sighting, Site, SpeciesRef } from "./types";

const square = (west: number, south: number, size: number): Ring => [
  [west, south],
  [west + size, south],
  [west + size, south + size],
  [west, south + size],
];

// A big square with a hole, plus a small far one: the hole must stay empty and the small one rarely wins
const FOREST: HabitatArea = {
  habitat: "forest",
  polygons: [
    [square(-66, -30, 4), square(-65, -29, 2)],
    [square(-60, -30, 0.2)],
  ],
};
const SEA: HabitatArea = { habitat: "sea", polygons: [[square(-60, -45, 3)]] };
const AREAS = [FOREST, SEA];

const SITES: Site[] = [
  { id: "a", habitat: "urban", point: [-58.382, -34.604] },
  { id: "b", habitat: "urban", point: [-64.183, -31.417] },
  { id: "c", habitat: "cave", point: [-70.657, -47.156] },
  { id: "d", habitat: "rare", point: [-70.011, -32.653] },
];

const SPECIES: SpeciesRef[] = [
  { id: 1, habitat: "forest" },
  { id: 7, habitat: "sea" },
  { id: 25, habitat: "urban" },
  { id: 41, habitat: "cave" },
  { id: 144, habitat: "rare" },
];

const byHabitat = new Map(SPECIES.map((s) => [s.id, s.habitat]));
const ofSpecies = (sightings: Sighting[], id: number) => sightings.filter((s) => s.speciesId === id);

function inArea(point: LngLat, habitat: Habitat, areas: HabitatArea[]): boolean {
  return areas.some((a) => a.habitat === habitat && a.polygons.some((polygon) => pointInPolygon(point, polygon)));
}

// The requirement, not MAX_SITE_OFFSET: rounding can carry a point a little past the offset
const SITE_REACH = 0.15;

function nearSite(point: LngLat, habitat: Habitat, sites: Site[]): boolean {
  return sites.some(
    (s) => s.habitat === habitat && Math.hypot(point[0] - s.point[0], point[1] - s.point[1]) <= SITE_REACH,
  );
}

describe("distribute", () => {
  test("is deterministic: two runs give the same sightings", () => {
    expect(distribute(SPECIES, AREAS, SITES)).toEqual(distribute(SPECIES, AREAS, SITES));
  });

  test("does not depend on the order of the species", () => {
    expect(distribute([...SPECIES].reverse(), AREAS, SITES)).toEqual(distribute(SPECIES, AREAS, SITES));
  });

  test("each species gets its own sequence: the same habitat does not repeat points", () => {
    const sightings = distribute(
      [
        { id: 1, habitat: "forest" },
        { id: 2, habitat: "forest" },
      ],
      AREAS,
      SITES,
    );
    expect(ofSpecies(sightings, 1).map((s) => s.point)).not.toEqual(ofSpecies(sightings, 2).map((s) => s.point));
  });

  test("count per habitat: rare 1, cave and urban 3, the rest 5", () => {
    const sightings = distribute(SPECIES, AREAS, SITES);
    expect(ofSpecies(sightings, 1)).toHaveLength(5);
    expect(ofSpecies(sightings, 7)).toHaveLength(5);
    expect(ofSpecies(sightings, 25)).toHaveLength(3);
    expect(ofSpecies(sightings, 41)).toHaveLength(3);
    expect(ofSpecies(sightings, 144)).toHaveLength(1);
  });

  test("area points fall inside a polygon of their habitat and outside its holes", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, habitat: "forest" as const }));
    const sightings = distribute(many, AREAS, SITES);
    expect(sightings).toHaveLength(300);
    for (const { point } of sightings) {
      expect(inArea(point, "forest", [FOREST]), `${point}`).toBe(true);
    }
  });

  test("picks polygons in proportion to their area", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, habitat: "forest" as const }));
    const small = distribute(many, AREAS, SITES).filter(({ point: [lng] }) => lng >= -60);
    // The small square is 0.04 of 12 square degrees: about 3 of 1000 points
    expect(small.length).toBeLessThan(20);
  });

  test("site points stay within 0.15° of a site of their habitat", () => {
    const sightings = distribute(SPECIES, AREAS, SITES);
    for (const { speciesId, point } of sightings.filter((s) => s.speciesId !== 1 && s.speciesId !== 7)) {
      expect(nearSite(point, byHabitat.get(speciesId)!, SITES), `${speciesId} ${point}`).toBe(true);
    }
  });

  test("the site offset leaves room for rounding within 0.15°", () => {
    expect(MAX_SITE_OFFSET).toBeLessThanOrEqual(SITE_REACH);
  });

  test("rounds coordinates to three decimals", () => {
    for (const { point } of distribute(SPECIES, AREAS, SITES)) {
      for (const value of point) expect(Math.round(value * 1000) / 1000).toBe(value);
    }
  });

  test("a habitat with no area nor site yields no points and does not throw", () => {
    expect(distribute([{ id: 9, habitat: "mountain" }], AREAS, SITES)).toEqual([]);
    expect(distribute([{ id: 9, habitat: "urban" }], AREAS, [])).toEqual([]);
  });

  test("a degenerate polygon is never picked", () => {
    const flat: HabitatArea = {
      habitat: "mountain",
      polygons: [
        [
          [
            [-66, -30],
            [-65, -30],
            [-64, -30],
          ],
        ],
      ],
    };
    expect(distribute([{ id: 3, habitat: "mountain" }], [flat], SITES)).toEqual([]);
  });

  test("sorts by species id", () => {
    const ids = distribute([...SPECIES].reverse(), AREAS, SITES).map((s) => s.speciesId);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test("property: every point falls in its habitat", () => {
    const species = fc.uniqueArray(
      fc.record({ id: fc.integer({ min: 1, max: 386 }), habitat: fc.constantFrom(...HABITATS) }),
      { selector: (s) => s.id, maxLength: 30 },
    );
    fc.assert(
      fc.property(species, (refs) => {
        const habitatOf = new Map(refs.map((s) => [s.id, s.habitat]));
        return distribute(refs, AREAS, SITES).every(({ speciesId, point }) => {
          const habitat = habitatOf.get(speciesId)!;
          return inArea(point, habitat, AREAS) || nearSite(point, habitat, SITES);
        });
      }),
      { seed: 42 },
    );
  });
});
