import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pointInRing } from "./point-in-ring";
import { createRng, randomPointInRing } from "./random";
import type { LngLat, Ring } from "./types";

function take(rng: () => number, count: number): number[] {
  return Array.from({ length: count }, () => rng());
}

const u: Ring = [
  [0, 0],
  [4, 0],
  [4, 3],
  [3, 3],
  [3, 1],
  [1, 1],
  [1, 3],
  [0, 3],
];

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    expect(take(createRng(42), 5)).toEqual(take(createRng(42), 5));
  });

  it("follows mulberry32, so seeded data stays stable across releases", () => {
    expect(take(createRng(42), 3)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });

  it("gives a different sequence for a different seed", () => {
    expect(take(createRng(1), 5)).not.toEqual(take(createRng(2), 5));
  });

  it("stays in [0, 1)", () => {
    for (const value of take(createRng(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("randomPointInRing", () => {
  it("returns the same inside point for the same seed", () => {
    const first = randomPointInRing(u, createRng(123));
    expect(first).not.toBeNull();
    expect(randomPointInRing(u, createRng(123))).toEqual(first);
    expect(pointInRing(first as LngLat, u)).toBe(true);
  });

  it("returns null for a degenerate (collinear) ring", () => {
    const flat: Ring = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    expect(randomPointInRing(flat, createRng(1))).toBeNull();
  });

  it("returns null for rings with fewer than 3 vertices", () => {
    expect(randomPointInRing([], createRng(1))).toBeNull();
    expect(
      randomPointInRing(
        [
          [0, 0],
          [1, 1],
        ],
        createRng(1),
      ),
    ).toBeNull();
  });

  it("returns null when no attempt lands inside", () => {
    // Always samples the middle of the bbox, which is the mouth of the U.
    let calls = 0;
    const center = () => {
      calls++;
      return 0.5;
    };
    expect(randomPointInRing(u, center, 10)).toBeNull();
    expect(calls).toBe(20);
  });
});

// Points on a circle in angle order always form a convex polygon.
const convexRing = fc
  .record({
    lng: fc.double({ min: -73, max: -53, noNaN: true }),
    lat: fc.double({ min: -55, max: -22, noNaN: true }),
    radius: fc.double({ min: 0.001, max: 1, noNaN: true }),
    offset: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
    jitters: fc.array(fc.double({ min: -0.4, max: 0.4, noNaN: true }), { minLength: 3, maxLength: 12 }),
  })
  .map(({ lng, lat, radius, offset, jitters }): Ring => {
    const step = (2 * Math.PI) / jitters.length;
    return jitters.map((jitter, k) => {
      const angle = offset + step * (k + jitter);
      return [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)];
    });
  });

describe("geometry properties", () => {
  it("randomPointInRing always lands inside a convex ring", () => {
    fc.assert(
      fc.property(convexRing, fc.integer(), (ring, seed) => {
        const point = randomPointInRing(ring, createRng(seed));
        expect(point).not.toBeNull();
        expect(pointInRing(point as LngLat, ring)).toBe(true);
      }),
      { seed: 42 },
    );
  });
});
