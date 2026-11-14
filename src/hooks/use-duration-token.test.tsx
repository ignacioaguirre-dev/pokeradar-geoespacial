import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseDuration, useDurationToken } from "./use-duration-token";

afterEach(() => {
  document.documentElement.style.removeProperty("--duration-medium");
});

describe("parseDuration", () => {
  it.each([
    ["240ms", 240],
    [" 0ms ", 0],
    ["0.9s", 900],
    ["", 0],
    ["fast", 0],
  ])("reads %j as %d ms", (raw, ms) => {
    expect(parseDuration(raw)).toBe(ms);
  });
});

describe("useDurationToken", () => {
  it("reads the token from the root element", () => {
    document.documentElement.style.setProperty("--duration-medium", "240ms");
    const { result } = renderHook(() => useDurationToken("--duration-medium"));
    expect(result.current).toBe(240);
  });
});
