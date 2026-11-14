import { describe, expect, test } from "vitest";
import { AREA_HABITATS, HABITATS, isAreaHabitat, SITE_HABITATS } from "./types";

describe("habitats", () => {
  test("areas and sites split the nine habitats with no overlap", () => {
    expect([...AREA_HABITATS, ...SITE_HABITATS].sort()).toEqual([...HABITATS].sort());
  });

  test("isAreaHabitat accepts only polygon habitats", () => {
    expect(isAreaHabitat("forest")).toBe(true);
    expect(isAreaHabitat("urban")).toBe(false);
    expect(isAreaHabitat("lava")).toBe(false);
  });
});
