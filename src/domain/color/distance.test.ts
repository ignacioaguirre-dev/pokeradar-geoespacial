import { describe, expect, it } from "vitest";
import { colorDistance } from "./distance";

describe("colorDistance (CIE76 ΔE)", () => {
  it("is 100 between black and white and 0 between equal colors", () => {
    expect(colorDistance("#000000", "#ffffff")).toBeCloseTo(100, 1);
    expect(colorDistance("#7A7266", "#7a7266")).toBe(0);
  });

  // Reference: pure sRGB red is L*a*b* (53.24, 80.09, 67.20) under D65
  it("matches the Lab reference for pure red against black", () => {
    expect(colorDistance("#ff0000", "#000000")).toBeCloseTo(Math.hypot(53.24, 80.09, 67.2), 0);
  });

  it("is symmetric", () => {
    expect(colorDistance("#e6d3b0", "#d9a55b")).toBeCloseTo(colorDistance("#d9a55b", "#e6d3b0"), 10);
  });

  it("rejects anything other than #RRGGBB", () => {
    expect(() => colorDistance("#FFF", "#000000")).toThrow(/#RRGGBB/);
  });
});
