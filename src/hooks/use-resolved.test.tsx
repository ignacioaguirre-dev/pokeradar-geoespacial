import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useResolved } from "./use-resolved";

describe("useResolved", () => {
  test("is undefined while pending and the value once resolved", async () => {
    let resolve!: (value: number) => void;
    const promise = new Promise<number>((r) => (resolve = r));
    const { result } = renderHook(() => useResolved(promise));
    expect(result.current).toBeUndefined();
    await act(async () => resolve(42));
    expect(result.current).toBe(42);
  });

  test("stays undefined when the promise rejects", async () => {
    const promise = Promise.reject(new Error("down"));
    const { result } = renderHook(() => useResolved(promise));
    await act(async () => {});
    expect(result.current).toBeUndefined();
  });

  test("ignores a promise that was replaced before it resolved", async () => {
    let resolveOld!: (value: string) => void;
    const old = new Promise<string>((r) => (resolveOld = r));
    const { result, rerender } = renderHook(({ p }) => useResolved(p), { initialProps: { p: old } });
    rerender({ p: Promise.resolve("new") });
    await act(async () => {});
    await act(async () => resolveOld("old"));
    expect(result.current).toBe("new");
  });

  test("without a promise it is undefined", () => {
    const { result } = renderHook(() => useResolved(undefined));
    expect(result.current).toBeUndefined();
  });
});
