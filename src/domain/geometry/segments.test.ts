import { describe, expect, it } from "vitest";
import { segmentsIntersect } from "./segments";

describe("segmentsIntersect", () => {
  it("detects an X crossing", () => {
    expect(segmentsIntersect([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true);
  });

  it("rejects separate parallel segments", () => {
    expect(segmentsIntersect([0, 0], [2, 0], [0, 1], [2, 1])).toBe(false);
  });

  it("rejects separate collinear segments", () => {
    expect(segmentsIntersect([0, 0], [1, 0], [2, 0], [3, 0])).toBe(false);
  });

  it("detects overlapping collinear segments", () => {
    expect(segmentsIntersect([0, 0], [2, 0], [1, 0], [3, 0])).toBe(true);
  });

  it("detects one segment containing a collinear one", () => {
    expect(segmentsIntersect([0, 0], [4, 0], [1, 0], [2, 0])).toBe(true);
  });

  it("detects an endpoint touching the other segment (T)", () => {
    expect(segmentsIntersect([0, 0], [2, 0], [1, 0], [1, 2])).toBe(true);
  });

  it("detects segments sharing a vertex", () => {
    expect(segmentsIntersect([0, 0], [1, 1], [1, 1], [2, 0])).toBe(true);
  });

  it("rejects non-parallel segments that would only meet beyond their ends", () => {
    expect(segmentsIntersect([0, 0], [1, 0], [2, 1], [2, 2])).toBe(false);
  });

  it("detects a degenerate segment (a point) lying on the other", () => {
    expect(segmentsIntersect([1, 0], [1, 0], [0, 0], [2, 0])).toBe(true);
  });

  it("rejects a degenerate segment (a point) off the other", () => {
    expect(segmentsIntersect([1, 1], [1, 1], [0, 0], [2, 0])).toBe(false);
  });

  it("absorbs float noise for a point meant to sit on the segment", () => {
    // Interpolated 10% along the segment; in floats it misses the line by ~2e-14.
    const point = [-64.78, -30.22] as const;
    expect(segmentsIntersect(point, point, [-65.3, -30.7], [-60.1, -25.9])).toBe(true);
  });

  it("works with coordinates far from 0,0 (Argentina)", () => {
    expect(segmentsIntersect([-65, -30], [-60, -25], [-65, -25], [-60, -30])).toBe(true);
    expect(segmentsIntersect([-65, -30], [-60, -30], [-65, -29], [-60, -29])).toBe(false);
  });
});
