import { describe, expect, it } from "vitest";
import { areaKm2 } from "@/domain/geometry/area";
import { centroid } from "@/domain/geometry/centroid";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { habitatsAt, onArgentineLand } from "@/testing/geo";
import { FENCES } from "./fences";

function cross(o: LngLat, a: LngLat, b: LngLat): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Strict crossing of two segments; touching endpoints of neighbors do not count
function crosses(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function isSimple(ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return false;
    }
  }
  return true;
}

// The sea fence lies off the coast: "inside Argentina" there means inside the Argentine Sea habitat
function insideArgentina(point: LngLat): boolean {
  return onArgentineLand(point) || habitatsAt(point).includes("sea");
}

describe("FENCES", () => {
  it("has one fence per recognizable biome", () => {
    expect(FENCES.map((f) => f.id).sort()).toEqual(
      ["ibera", "misiones", "monte", "pampa", "patagonia", "puna", "sea", "yungas"].sort(),
    );
  });

  describe.each(FENCES.map((f) => [f.id, f] as const))("%s", (_id, fence) => {
    it("has 5 to 8 vertices without crossings", () => {
      expect(fence.ring.length).toBeGreaterThanOrEqual(5);
      expect(fence.ring.length).toBeLessThanOrEqual(8);
      expect(isSimple(fence.ring)).toBe(true);
    });

    it("covers 50 000 to 150 000 km² (Misiones: the province is smaller, so 20 000)", () => {
      const area = areaKm2(fence.ring);
      expect(area).toBeGreaterThanOrEqual(fence.id === "misiones" ? 20_000 : 50_000);
      expect(area).toBeLessThanOrEqual(150_000);
    });

    it("has its centroid in the habitat it claims", () => {
      expect(habitatsAt(centroid(fence.ring))).toEqual([fence.habitat]);
    });

    it("stays inside Argentina", () => {
      for (const vertex of fence.ring) expect(insideArgentina(vertex), `${vertex}`).toBe(true);
    });
  });

  // The sea habitat spreads its 40 species over a huge shelf: a small fence there finds almost nothing
  describe("sea", () => {
    const sea = FENCES.find((f) => f.id === "sea")!;

    it("is as big as the rule allows", () => {
      expect(areaKm2(sea.ring)).toBeGreaterThanOrEqual(140_000);
    });

    // Vertices alone would let an edge cut across Península Valdés or past the shelf
    it("lies entirely in the sea habitat: no land, no open ocean, clear of Malvinas", () => {
      const { ring } = sea;
      for (let i = 0; i < ring.length; i++) {
        const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
        for (let step = 0; step <= 20; step++) {
          const t = step / 20;
          const point: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          expect(habitatsAt(point), `${point}`).toEqual(["sea"]);
          expect(onArgentineLand(point), `${point}`).toBe(false);
        }
      }
    });
  });
});
