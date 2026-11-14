import { describe, expect, it } from "vitest";
import { composite, contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("is 21 between black and white and 1 between equal colors", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#7A7266", "#7A7266")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#0B0E12", "#F1EDE4")).toBeCloseTo(contrastRatio("#F1EDE4", "#0B0E12"), 10);
  });

  it("accepts lowercase", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("rejects anything other than #RRGGBB", () => {
    expect(() => contrastRatio("#FFF", "#000000")).toThrow(/#RRGGBB/);
    expect(() => contrastRatio("red", "#000000")).toThrow(/#RRGGBB/);
  });
});

describe("composite", () => {
  it("lays a color over another at an opacity, per sRGB channel", () => {
    expect(composite("#ffffff", "#000000", 0.5)).toBe("#808080");
    expect(composite("#3f6b3a", "#2a261e", 0.35)).toBe("#313e28");
  });

  it("returns the ground at 0 and the color at 1", () => {
    expect(composite("#d9a55b", "#2a261e", 0)).toBe("#2a261e");
    expect(composite("#d9a55b", "#2a261e", 1)).toBe("#d9a55b");
  });

  it("rejects an opacity outside 0–1", () => {
    expect(() => composite("#ffffff", "#000000", 1.5)).toThrow(RangeError);
  });
});
