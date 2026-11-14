import { describe, expect, test } from "vitest";
import type { Fence } from "@/domain/geometry/types";
import { detect } from "./detect";
import type { Sighting } from "./types";

// Centroid at (0, 0)
const FENCE: Fence = {
  id: "box",
  ring: [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
};

const at = (speciesId: number, lng: number, lat: number): Sighting => ({ speciesId, point: [lng, lat] });

describe("detect", () => {
  test("a fence with nothing inside traces nothing", () => {
    expect(detect(FENCE, [at(1, 5, 5), at(2, -3, 0)])).toEqual({ traced: [], weakSignals: 0 });
  });

  test("an empty or degenerate fence traces nothing", () => {
    expect(detect({ id: "empty", ring: [] }, [at(1, 0, 0)])).toEqual({ traced: [], weakSignals: 0 });
    expect(
      detect(
        {
          id: "line",
          ring: [
            [0, 0],
            [1, 1],
          ],
        },
        [at(1, 0, 0)],
      ),
    ).toEqual({ traced: [], weakSignals: 0 });
  });

  test("more than 12 species: 12 traced and the rest as weak signals", () => {
    const sightings = Array.from({ length: 20 }, (_, i) => at(i + 1, 0.04 * i, 0));
    const { traced, weakSignals } = detect(FENCE, sightings);
    expect(traced.map((s) => s.speciesId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(weakSignals).toBe(8);
  });

  test("honors a custom limit", () => {
    const sightings = [at(1, 0.1, 0), at(2, 0.2, 0), at(3, 0.3, 0)];
    expect(detect(FENCE, sightings, 2)).toEqual({ traced: [at(1, 0.1, 0), at(2, 0.2, 0)], weakSignals: 1 });
  });

  test("a species with several points inside counts once, by its point nearest the centroid", () => {
    const { traced, weakSignals } = detect(FENCE, [at(7, 0.8, 0.8), at(7, 0.1, 0), at(7, -0.5, 0), at(7, 9, 9)]);
    expect(traced).toEqual([at(7, 0.1, 0)]);
    expect(weakSignals).toBe(0);
  });

  test("orders by distance to the centroid and breaks ties by the lower id", () => {
    const sightings = [at(30, 0.5, 0), at(9, 0, 0.5), at(4, 0.9, 0), at(12, 0.2, 0), at(2, -0.5, 0)];
    expect(detect(FENCE, sightings).traced.map((s) => s.speciesId)).toEqual([12, 2, 9, 30, 4]);
  });

  test("a point on the edge counts as inside", () => {
    expect(detect(FENCE, [at(5, 1, 0), at(6, -1, -1)]).traced.map((s) => s.speciesId)).toEqual([5, 6]);
  });

  test("measures east-west distance shrunk by latitude", () => {
    // At 60° S a degree of longitude is half a degree of latitude
    const south: Fence = {
      id: "south",
      ring: [
        [-1, -61],
        [1, -61],
        [1, -59],
        [-1, -59],
      ],
    };
    const sightings = [at(1, 0, -59.4), at(2, 0.9, -60)];
    expect(detect(south, sightings).traced.map((s) => s.speciesId)).toEqual([2, 1]);
  });
});
