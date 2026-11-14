import { describe, expect, it } from "vitest";
import { crowded } from "./crowded";

describe("crowded", () => {
  it("is false when every pair is at least the minimum apart", () => {
    expect(
      crowded(
        [
          [0, 0],
          [48, 0],
          [0, 48],
        ],
        48,
      ),
    ).toBe(false);
  });

  it("is true when any pair is closer than the minimum, even diagonally", () => {
    expect(
      crowded(
        [
          [0, 0],
          [200, 0],
          [230, 30],
        ],
        48,
      ),
    ).toBe(true);
  });

  it("finds the close pair wherever it sits in the list", () => {
    expect(
      crowded(
        [
          [10, 10],
          [300, 300],
          [600, 10],
          [12, 40],
        ],
        48,
      ),
    ).toBe(true);
  });

  it("two creatures on the same spot are crowded", () => {
    expect(
      crowded(
        [
          [5, 5],
          [5, 5],
        ],
        48,
      ),
    ).toBe(true);
  });

  it("none or one position is never crowded", () => {
    expect(crowded([], 48)).toBe(false);
    expect(crowded([[0, 0]], 48)).toBe(false);
  });
});
