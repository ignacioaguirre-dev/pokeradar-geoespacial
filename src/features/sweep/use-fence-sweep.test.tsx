import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Fence } from "@/domain/geometry/types";
import type { SightingsPayload } from "./types";
import { displayName, useFenceSweep } from "./use-fence-sweep";

const FENCES: Fence[] = [
  {
    id: "box",
    ring: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  {
    id: "far",
    ring: [
      [10, 10],
      [11, 10],
      [11, 11],
      [10, 11],
    ],
  },
];

// slugs[id - 1]
const PAYLOAD: SightingsPayload = {
  sightings: [
    [2, 0.5, 0],
    [1, 0.1, 0],
    [3, 5, 5],
  ],
  slugs: ["bulbasaur", "mr-mime", "squirtle"],
};

describe("displayName", () => {
  it("capitalizes the slug until the detail brings the real name", () => {
    expect(displayName("pikachu")).toBe("Pikachu");
    expect(displayName("mr-mime")).toBe("Mr-mime");
  });
});

describe("useFenceSweep", () => {
  it("starts with no fence and nothing detected", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, PAYLOAD));
    expect(result.current.fence).toBeNull();
    expect(result.current.detection).toEqual({ status: "idle" });
  });

  it("choosing a fence detects its creatures, nearest first, with their names", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, PAYLOAD));
    act(() => result.current.choose("box"));
    expect(result.current.fence?.id).toBe("box");
    expect(result.current.detection).toEqual({
      status: "ready",
      weakSignals: 0,
      traced: [
        { id: 1, name: "Bulbasaur", point: [0.1, 0] },
        { id: 2, name: "Mr-mime", point: [0.5, 0] },
      ],
    });
  });

  it("a fence with nothing inside is empty, not an error", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, PAYLOAD));
    act(() => result.current.choose("far"));
    expect(result.current.detection).toEqual({ status: "ready", traced: [], weakSignals: 0 });
  });

  it("is loading while the sightings have not arrived", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, undefined));
    act(() => result.current.choose("box"));
    expect(result.current.detection).toEqual({ status: "loading" });
  });

  it("is unavailable when the sightings failed", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, null));
    act(() => result.current.choose("box"));
    expect(result.current.detection).toEqual({ status: "unavailable" });
  });

  // The map replays the sweep whenever the traced list changes identity
  it("keeps the same detection across renders", () => {
    const { result, rerender } = renderHook(() => useFenceSweep(FENCES, PAYLOAD));
    act(() => result.current.choose("box"));
    const first = result.current.detection;
    rerender();
    expect(result.current.detection).toBe(first);
  });

  it("ignores an unknown fence", () => {
    const { result } = renderHook(() => useFenceSweep(FENCES, PAYLOAD));
    act(() => result.current.choose("atlantis"));
    expect(result.current.fence).toBeNull();
  });
});
