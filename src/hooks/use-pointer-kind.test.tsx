import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type PointerKind, usePointerKind } from "./use-pointer-kind";

const COARSE = "(pointer: coarse)";
const FINE_HOVER = "(pointer: fine) and (hover: hover)";
const ANY_COARSE = "(any-pointer: coarse)";

let matching = new Set<string>();
const listeners = new Set<() => void>();
const originalMatchMedia = window.matchMedia;

function setMatching(...queries: string[]) {
  matching = new Set(queries);
}

describe("usePointerKind", () => {
  beforeEach(() => {
    setMatching();
    listeners.clear();
    window.matchMedia = (query: string) =>
      ({
        get matches() {
          return matching.has(query);
        },
        media: query,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it.each<[string, string[], PointerKind]>([
    ["a phone (coarse primary pointer)", [COARSE, ANY_COARSE], "coarse"],
    ["a desktop with mouse or touchpad", [FINE_HOVER], "fine"],
    ["a laptop with a touch screen", [FINE_HOVER, ANY_COARSE], "hybrid"],
    ["a fine pointer that cannot hover, beside a touch screen", [ANY_COARSE], "coarse"],
    ["no pointer at all (keyboard only)", [], "fine"],
  ])("reads %s", (_, queries, kind) => {
    setMatching(...queries);
    const { result } = renderHook(() => usePointerKind());
    expect(result.current).toBe(kind);
  });

  it("follows a change in the media queries", () => {
    setMatching(FINE_HOVER);
    const { result } = renderHook(() => usePointerKind());
    setMatching(FINE_HOVER, ANY_COARSE);
    act(() => listeners.forEach((listener) => listener()));
    expect(result.current).toBe("hybrid");
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderHook(() => usePointerKind());
    expect(listeners.size).toBeGreaterThan(0);
    unmount();
    expect(listeners.size).toBe(0);
  });

  // Each render reads the snapshot; the three lists are made once and shared with the subscription
  it("asks the browser for each media query once", async () => {
    vi.resetModules();
    const { usePointerKind: fresh } = await import("./use-pointer-kind");
    const install = window.matchMedia;
    const matchMedia = vi.fn((query: string) => install(query));
    window.matchMedia = matchMedia;
    setMatching(FINE_HOVER);
    const { rerender, unmount } = renderHook(() => fresh());
    rerender();
    setMatching(FINE_HOVER, ANY_COARSE);
    act(() => listeners.forEach((listener) => listener()));
    unmount();
    renderHook(() => fresh());
    expect(matchMedia).toHaveBeenCalledTimes(3);
  });

  it("knows nothing on the server", () => {
    function Probe() {
      return <span>{String(usePointerKind())}</span>;
    }
    expect(renderToString(<Probe />)).toContain("null");
  });
});
