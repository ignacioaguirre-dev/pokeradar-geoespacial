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
