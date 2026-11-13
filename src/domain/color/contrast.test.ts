import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

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
