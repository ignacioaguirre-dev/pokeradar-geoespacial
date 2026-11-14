import { describe, expect, it } from "vitest";
import { pointInRing } from "./point-in-ring";
import type { Ring } from "./types";

const square: Ring = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

// U open to the north: the notch spans x 1..3, y 1..3.
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

describe("pointInRing", () => {
  it("is true inside and false outside", () => {
    expect(pointInRing([2, 2], square)).toBe(true);
    expect(pointInRing([5, 2], square)).toBe(false);
    expect(pointInRing([2, -1], square)).toBe(false);
  });

  it("counts a point on an edge as inside", () => {
    expect(pointInRing([2, 0], square)).toBe(true);
    expect(pointInRing([4, 2], square)).toBe(true);
    expect(pointInRing([2, 4], square)).toBe(true);
    expect(pointInRing([0, 2], square)).toBe(true);
  });

  it("counts a point on a vertex as inside", () => {
    for (const vertex of square) expect(pointInRing(vertex, square)).toBe(true);
  });

  it("is false in the mouth of a concave U and true in its arms", () => {
    expect(pointInRing([2, 2], u)).toBe(false);
    expect(pointInRing([0.5, 2], u)).toBe(true);
    expect(pointInRing([3.5, 2], u)).toBe(true);
    expect(pointInRing([2, 0.5], u)).toBe(true);
  });

  it("counts the inner edges of the U as inside", () => {
    expect(pointInRing([2, 1], u)).toBe(true);
    expect(pointInRing([1, 2], u)).toBe(true);
  });

  it("is false for rings with fewer than 3 vertices", () => {
    expect(
      pointInRing(
        [0.5, 0],
        [
          [0, 0],
          [1, 0],
        ],
      ),
    ).toBe(false);
    expect(pointInRing([0, 0], [[0, 0]])).toBe(false);
    expect(pointInRing([0, 0], [])).toBe(false);
  });

  it("gives the same answer clockwise and counter-clockwise", () => {
    const reversed = [...u].reverse();
    for (const point of [[2, 2], [0.5, 2], [2, 1], [5, 5], [3, 3]] as const) {
      expect(pointInRing(point, reversed)).toBe(pointInRing(point, u));
    }
  });
});
