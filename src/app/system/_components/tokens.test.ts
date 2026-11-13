import { describe, expect, it } from "vitest";
import { contrastOnBackground } from "./tokens";

describe("contrastOnBackground", () => {
  it("stays pending while the values have not been read", () => {
    expect(contrastOnBackground("foreground", "", "#0B0E12")).toEqual({ kind: "pending" });
    expect(contrastOnBackground("foreground", "#F1EDE4", "")).toEqual({ kind: "pending" });
  });

  it("the background has no contrast against itself", () => {
    expect(contrastOnBackground("background", "#0B0E12", "#0B0E12")).toEqual({ kind: "base" });
  });

  it("measures the contrast of the rest", () => {
    const result = contrastOnBackground("foreground", "#F1EDE4", "#0B0E12");
    expect(result.kind).toBe("measured");
    if (result.kind === "measured") expect(result.ratio).toBeCloseTo(16.55, 1);
  });

  it("flags whether the token usage meets its minimum", () => {
    expect(contrastOnBackground("foreground", "#F1EDE4", "#0B0E12")).toMatchObject({ meets: true });
    expect(contrastOnBackground("foreground", "#3B3832", "#0B0E12")).toMatchObject({ meets: false });
    expect(contrastOnBackground("structure", "#3B3832", "#0B0E12")).toMatchObject({ meets: null });
  });
});
