import { describe, expect, it } from "vitest";
import { onArgentineLand } from "@/testing/geo";
import { SITES } from "./sites";

describe("SITES", () => {
  it("covers the three point habitats", () => {
    expect(new Set(SITES.map((s) => s.habitat))).toEqual(new Set(["urban", "cave", "rare"]));
  });

  it("has unique ids", () => {
    const ids = SITES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SITES.map((s) => [s.id, s] as const))("%s is on Argentine land", (_id, site) => {
    expect(onArgentineLand(site.point)).toBe(true);
  });

  it("uses 3-decimal coordinates", () => {
    for (const { point } of SITES) {
      for (const value of point) expect(Math.round(value * 1000) / 1000).toBe(value);
    }
  });
});
