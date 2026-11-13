import { describe, expect, it } from "vitest";
import { centroid } from "./centroid";

describe("centroid", () => {
  it("is the exact center of a square", () => {
    expect(
      centroid([
        [-60, -35],
        [-58, -35],
        [-58, -33],
        [-60, -33],
      ]),
    ).toEqual([-59, -34]);
  });

  it("is the vertex average for a triangle", () => {
    const [lng, lat] = centroid([
      [0, 0],
      [6, 0],
      [0, 3],
    ]);
    expect(lng).toBeCloseTo(2, 12);
    expect(lat).toBeCloseTo(1, 12);
  });

  it("weights by area, not by vertex count", () => {
    // Extra collinear vertices on the bottom edge would drag a vertex average south.
    const [lng, lat] = centroid([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
    expect(lng).toBeCloseTo(2, 12);
    expect(lat).toBeCloseTo(2, 12);
  });

  it("falls back to the vertex average for a degenerate (collinear) ring", () => {
    expect(
      centroid([
        [0, 0],
        [1, 1],
        [5, 5],
      ]),
    ).toEqual([2, 2]);
  });

  it("returns the vertex itself for a single vertex", () => {
    expect(centroid([[-58, -34]])).toEqual([-58, -34]);
  });

  it("throws a RangeError for an empty ring", () => {
    expect(() => centroid([])).toThrow(RangeError);
  });
});
