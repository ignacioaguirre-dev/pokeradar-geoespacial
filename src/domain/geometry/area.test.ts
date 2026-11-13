import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { areaKm2 } from "./area";
import type { Ring } from "./types";

const equatorSquare: Ring = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const buenosAiresSquare: Ring = [
  [-59, -35],
  [-58, -35],
  [-58, -34],
  [-59, -34],
];

function expectWithin(actual: number, expected: number, relative: number) {
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(relative);
}

describe("areaKm2", () => {
  it("measures a 1° × 1° square on the equator as ~12 364 km²", () => {
    expectWithin(areaKm2(equatorSquare), 12_364, 0.005);
  });

  it("measures a 1° × 1° square between -35° and -34° as ~10 189 km²", () => {
    expectWithin(areaKm2(buenosAiresSquare), 10_189, 0.005);
  });

  it("does not depend on the winding direction", () => {
    expect(areaKm2([...buenosAiresSquare].reverse())).toBeCloseTo(areaKm2(buenosAiresSquare), 9);
  });

  it("is 0 for rings with fewer than 3 vertices", () => {
    expect(areaKm2([])).toBe(0);
    expect(areaKm2([[0, 0]])).toBe(0);
    expect(
      areaKm2([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(0);
  });
});

// Any simple or self-crossing ring works here: the invariance is about vertex order, not shape.
const ring = fc.array(
  fc.tuple(fc.double({ min: -73, max: -53, noNaN: true }), fc.double({ min: -55, max: -22, noNaN: true })),
  { minLength: 3, maxLength: 12 },
);

describe("areaKm2 properties", () => {
  it("does not change when the vertices are rotated or reversed", () => {
    fc.assert(
      fc.property(ring, fc.nat(), (vertices, shift) => {
        const base = areaKm2(vertices);
        const k = shift % vertices.length;
        const rotated = [...vertices.slice(k), ...vertices.slice(0, k)];
        const tolerance = Math.max(base, 1) * 1e-9;
        expect(Math.abs(areaKm2(rotated) - base)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(areaKm2([...vertices].reverse()) - base)).toBeLessThanOrEqual(tolerance);
      }),
      { seed: 42 },
    );
  });
});
