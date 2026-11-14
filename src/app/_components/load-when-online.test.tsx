import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWhenOnline } from "./load-when-online";

function setOnLine(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadWhenOnline", () => {
  it("waits for the connection instead of failing when a chunk cannot download offline", async () => {
    setOnLine(false);
    const load = vi.fn().mockRejectedValueOnce(new Error("ChunkLoadError")).mockResolvedValueOnce("panel");
    let settled = false;
    const loaded = loadWhenOnline(load).finally(() => (settled = true));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(settled).toBe(false);
    setOnLine(true);
    window.dispatchEvent(new Event("online"));
    await expect(loaded).resolves.toBe("panel");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("still fails when the chunk is missing with a network", async () => {
    setOnLine(true);
    const error = new Error("ChunkLoadError");
    await expect(loadWhenOnline(() => Promise.reject(error))).rejects.toBe(error);
  });
});
