import { describe, expect, it } from "vitest";
import { COLOR_USAGE, meetsUsage } from "./usage";

describe("meetsUsage", () => {
  it("compares against the usage minimum", () => {
    expect(meetsUsage(4.5, COLOR_USAGE.foreground)).toBe(true);
    expect(meetsUsage(4.49, COLOR_USAGE.foreground)).toBe(false);
    expect(meetsUsage(3, COLOR_USAGE.energy)).toBe(true);
    expect(meetsUsage(2.9, COLOR_USAGE.control)).toBe(false);
  });

  it("returns null when the usage has no minimum", () => {
    expect(meetsUsage(1.2, COLOR_USAGE.structure)).toBeNull();
    expect(meetsUsage(1, COLOR_USAGE.background)).toBeNull();
  });
});
