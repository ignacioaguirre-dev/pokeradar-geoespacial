import { describe, expect, it } from "vitest";
import { bbox } from "./bbox";

describe("bbox", () => {
  it("returns the exact west, south, east and north of the ring", () => {
    expect(
      bbox([
        [-58.5, -34.7],
        [-58.3, -34.5],
        [-58.4, -34.9],
      ]),
    ).toEqual([-58.5, -34.9, -58.3, -34.5]);
  });

  it("collapses to the point for a single vertex", () => {
    expect(bbox([[1, 2]])).toEqual([1, 2, 1, 2]);
  });

  it("throws a RangeError for an empty ring", () => {
    expect(() => bbox([])).toThrow(RangeError);
  });
});
