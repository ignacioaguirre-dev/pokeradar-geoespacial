import { describe, expect, test } from "vitest";
import { SITES } from "@/data/sites";
import { AREA_HABITATS } from "@/domain/habitat/types";
import { HABITAT_AREAS, SIGHTING_SITES, toHabitatAreas } from "./territory";

describe("territory", () => {
  test("adapts every area habitat of the GeoJSON, polygons as outer ring plus holes", () => {
    expect(HABITAT_AREAS.map((a) => a.habitat).sort()).toEqual([...AREA_HABITATS].sort());
    for (const area of HABITAT_AREAS) {
      expect(area.polygons.length).toBeGreaterThan(0);
      for (const polygon of area.polygons) expect(polygon[0].length).toBeGreaterThanOrEqual(3);
    }
  });

  test("closed GeoJSON rings become open rings", () => {
    const [area] = toHabitatAreas({
      features: [
        {
          properties: { habitat: "sea" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    });
    expect(area.polygons).toEqual([
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      ],
    ]);
  });

  test("skips features whose habitat is not an area habitat", () => {
    const areas = toHabitatAreas({
      features: [
        {
          properties: { habitat: "lava" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
              ],
            ],
          },
        },
      ],
    });
    expect(areas).toEqual([]);
  });

  test("hands over every curated site", () => {
    expect(SIGHTING_SITES).toEqual(SITES);
  });
});
