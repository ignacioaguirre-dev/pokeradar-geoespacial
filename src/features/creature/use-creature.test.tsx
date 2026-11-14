import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatureDetail } from "@/features/catalog/types";
import { useCreature } from "./use-creature";

function detail(id: number, name = "Pikachu"): CreatureDetail {
  return {
    id,
    name,
    types: ["electric"],
    stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
    heightM: 0.4,
    weightKg: 6,
    sprite: { animated: "https://raw.githubusercontent.com/a.gif", still: "https://raw.githubusercontent.com/s.png" },
    cry: "https://raw.githubusercontent.com/c.ogg",
    flavor: "Texto.",
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The cache lives for the session, so every test uses its own ids
describe("useCreature", () => {
  it("is idle without an id and does not fetch", () => {
    const { result } = renderHook(() => useCreature(null));
    expect(result.current.state).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads and becomes ready with the creature", async () => {
    fetchMock.mockResolvedValue(json(detail(1)));
    const { result } = renderHook(() => useCreature(1));
    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.data).toEqual(detail(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/creatures/1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("maps a 404 to not-found", async () => {
    fetchMock.mockResolvedValue(json({ error: "not-found" }, 404));
    const { result } = renderHook(() => useCreature(2));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("not-found");
  });

  it("maps a 502 to unavailable", async () => {
    fetchMock.mockResolvedValue(json({ error: "unavailable" }, 502));
    const { result } = renderHook(() => useCreature(3));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("unavailable");
  });

  it("maps a network failure to unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useCreature(4));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("unavailable");
  });

  it.each([
    ["a missing stat", { ...detail(5), stats: { hp: 1 } }],
    ["an unknown type", { ...detail(5), types: ["laser"] }],
    ["a sprite without a still image", { ...detail(5), sprite: { animated: null } }],
    ["a non-JSON body", "<html>"],
    ["another creature's id", detail(99)],
  ])("maps an invalid shape (%s) to unavailable", async (_, body) => {
    fetchMock.mockResolvedValue(
      typeof body === "string" ? new Response(body, { status: 200 }) : json(body),
    );
    const { result } = renderHook(() => useCreature(5));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("unavailable");
  });

  it("retry fetches again and recovers", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "unavailable" }, 502)).mockResolvedValueOnce(json(detail(6)));
    const { result } = renderHook(() => useCreature(6));
    await waitFor(() => expect(result.current.state).toBe("error"));
    act(() => result.current.retry());
    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("changing the id aborts the previous request and never shows its data", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      if (url.endsWith("/7")) return new Promise<Response>((resolve) => (resolveFirst = resolve));
      return Promise.resolve(json(detail(8, "Raichu")));
    });
    const { result, rerender } = renderHook(({ id }) => useCreature(id), { initialProps: { id: 7 } });
    rerender({ id: 8 });
    expect(signals[0].aborted).toBe(true);
    await waitFor(() => expect(result.current.state).toBe("ready"));
    resolveFirst(json(detail(7, "Pichu")));
    await Promise.resolve();
    expect(result.current.data?.name).toBe("Raichu");
  });

  it("reopening a creature that failed shows loading, not the old error, while it asks again", async () => {
    let respond: (response: Response) => void = () => {};
    fetchMock
      .mockResolvedValueOnce(json({ error: "unavailable" }, 502))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (respond = resolve)));
    const { result, rerender } = renderHook(({ id }) => useCreature(id), {
      initialProps: { id: 11 as number | null },
    });
    await waitFor(() => expect(result.current.state).toBe("error"));
    rerender({ id: null });
    expect(result.current.state).toBe("idle");
    rerender({ id: 11 });
    expect(result.current.state).toBe("loading");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    respond(json(detail(11)));
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("unmounting aborts the request", () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return new Promise<Response>(() => {});
    });
    const { unmount } = renderHook(() => useCreature(9));
    unmount();
    expect(signals[0].aborted).toBe(true);
  });

  it("a second request for the same id comes from the cache", async () => {
    fetchMock.mockResolvedValue(json(detail(10)));
    const first = renderHook(() => useCreature(10));
    await waitFor(() => expect(first.result.current.state).toBe("ready"));
    first.unmount();

    const second = renderHook(() => useCreature(10));
    expect(second.result.current.state).toBe("ready");
    expect(second.result.current.data).toEqual(detail(10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
