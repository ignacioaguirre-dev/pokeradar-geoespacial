import { describe, expect, it } from "vitest";
import { pointInPolygon } from "./point-in-polygon";
import type { Ring } from "./types";

const OUTER: Ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const HOLE: Ring = [
  [4, 4],
  [6, 4],
  [6, 6],
  [4, 6],
];

describe("pointInPolygon", () => {
  it("finds a point inside the outer ring", () => {
    expect(pointInPolygon([2, 2], [OUTER, HOLE])).toBe(true);
  });

  it("excludes a point inside a hole", () => {
    expect(pointInPolygon([5, 5], [OUTER, HOLE])).toBe(false);
  });

  it("excludes a point outside the outer ring", () => {
    expect(pointInPolygon([12, 5], [OUTER, HOLE])).toBe(false);
  });

  it("keeps the outer edge inside, like pointInRing", () => {
    expect(pointInPolygon([0, 5], [OUTER])).toBe(true);
  });

  // The hole's edge belongs to the neighbor that fills it, so it is not part of this polygon
  it("leaves a point on a hole's edge outside", () => {
    expect(pointInPolygon([4, 5], [OUTER, HOLE])).toBe(false);
  });

  it("accepts GeoJSON rings that repeat the first vertex", () => {
    expect(pointInPolygon([2, 2], [[...OUTER, OUTER[0]]])).toBe(true);
  });

  it("is false for an empty polygon", () => {
    expect(pointInPolygon([2, 2], [])).toBe(false);
  });
});
