import { describe, expect, test } from "vitest";
import { fromCompact, toCompact } from "./compact";

describe("compact sightings", () => {
  test("packs each sighting as [speciesId, lng, lat] and back", () => {
    const sightings = [
      { speciesId: 25, point: [-58.382, -34.604] as const },
      { speciesId: 7, point: [-60.1, -45.25] as const },
    ];
    expect(toCompact(sightings)).toEqual([
      [25, -58.382, -34.604],
      [7, -60.1, -45.25],
    ]);
    expect(fromCompact(toCompact(sightings))).toEqual(sightings);
  });
});
