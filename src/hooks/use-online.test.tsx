import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnline } from "./use-online";

function setOnLine(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

function emit(type: "online" | "offline") {
  act(() => {
    window.dispatchEvent(new Event(type));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOnline", () => {
  it("starts from the browser's current state", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("renders online on the server, so hydration never flashes an offline state", () => {
    function Probe() {
      return <p>{String(useOnline())}</p>;
    }
    expect(renderToString(<Probe />)).toContain("true");
  });

  it("follows the offline and online events", () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnline());
    setOnLine(false);
    emit("offline");
    expect(result.current).toBe(false);
    setOnLine(true);
    emit("online");
    expect(result.current).toBe(true);
  });

  it("stops listening once unmounted", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnline());
    unmount();
    const removed = remove.mock.calls.map(([type]) => type);
    expect(removed).toEqual(expect.arrayContaining(["online", "offline"]));
  });
});
