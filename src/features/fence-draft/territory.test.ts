import { describe, expect, it } from "vitest";
import type { LngLat } from "@/domain/geometry/types";
import { isInTerritory } from "./territory";

describe("isInTerritory", () => {
  it.each<[string, LngLat]>([
    ["Córdoba", [-64.18, -31.42]],
    ["Ushuaia", [-68.3, -54.8]],
    ["the shelf off Península Valdés", [-62.5, -43]],
    // Holes of the shelf polygon, yet Argentina
    ["Malvinas", [-58.8, -51.75]],
    ["Isla de los Estados", [-64.3, -54.8]],
  ])("accepts %s", (_, point) => {
    expect(isInTerritory(point)).toBe(true);
  });

  it.each<[string, LngLat]>([
    ["Santiago de Chile", [-70.65, -33.45]],
    ["Montevideo", [-56.17, -34.9]],
    ["Asunción", [-57.58, -25.3]],
    ["the open Atlantic past the shelf", [-50, -45]],
  ])("rejects %s", (_, point) => {
    expect(isInTerritory(point)).toBe(false);
  });
});
