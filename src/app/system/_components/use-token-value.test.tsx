import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTokenValue } from "./use-token-value";

afterEach(() => document.documentElement.style.removeProperty("--color-probe"));

describe("useTokenValue", () => {
  it("reads the token value from the document", () => {
    document.documentElement.style.setProperty("--color-probe", " #123456 ");
    const { result } = renderHook(() => useTokenValue("probe"));
    expect(result.current).toBe("#123456");
  });

  it("returns empty when the token does not exist", () => {
    const { result } = renderHook(() => useTokenValue("missing"));
    expect(result.current).toBe("");
  });
});
