import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { UpstreamError } from "./errors";
import { createJsonFetcher } from "./fetch-json";

const schema = z.object({ name: z.string() });
const BASE = "https://upstream.test/v1";
const fetchJson = createJsonFetcher({ baseUrl: () => BASE, timeoutMs: 8000 });

const respond = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );

const kindOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(UpstreamError);
  return (error as UpstreamError).kind;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createJsonFetcher", () => {
  it("returns the parsed body when it matches the schema", async () => {
    const fetchMock = respond({ name: "pikachu", extra: true });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("/pokemon/25", schema)).resolves.toEqual({ name: "pikachu" });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/pokemon/25`, { signal: expect.any(AbortSignal) });
  });

  it("reads the base URL on every call", async () => {
    let base = "http://one.test";
    const fetcher = createJsonFetcher({ baseUrl: () => base, timeoutMs: 8000 });
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ name: "x" })));
    vi.stubGlobal("fetch", fetchMock);

    await fetcher("/a", schema);
    base = "http://two.test";
    await fetcher("/a", schema);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["http://one.test/a", "http://two.test/a"]);
  });

  it("throws not-found on 404", async () => {
    vi.stubGlobal("fetch", respond("Not Found", 404));
    expect(await kindOf(fetchJson("/pokemon/9999", schema))).toBe("not-found");
  });

  it("throws unavailable on a server error", async () => {
    vi.stubGlobal("fetch", respond("boom", 500));
    expect(await kindOf(fetchJson("/pokemon/25", schema))).toBe("unavailable");
  });

  it("throws unavailable when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await kindOf(fetchJson("/pokemon/25", schema))).toBe("unavailable");
  });

  it("throws unavailable when upstream does not answer within timeoutMs", async () => {
    vi.useFakeTimers();
    // Node's AbortSignal.timeout ignores fake timers, so rebuild it on top of them.
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason))),
      ),
    );
    const fetcher = createJsonFetcher({ baseUrl: () => BASE, timeoutMs: 1234 });

    const result = kindOf(fetcher("/pokemon/25", schema));
    await vi.advanceTimersByTimeAsync(1234);
    expect(await result).toBe("unavailable");
    expect(timeout).toHaveBeenCalledWith(1234);
  });

  it("throws invalid when the body is not JSON", async () => {
    vi.stubGlobal("fetch", respond("<html>oops</html>"));
    expect(await kindOf(fetchJson("/pokemon/25", schema))).toBe("invalid");
  });

  it("throws invalid when the body does not match the schema", async () => {
    vi.stubGlobal("fetch", respond({ name: 25 }));
    expect(await kindOf(fetchJson("/pokemon/25", schema))).toBe("invalid");
  });

  it.each([
    ["a server error", "secret upstream text", 500],
    ["an invalid shape", { name: "secret upstream text".length, secret: "secret upstream text" }, 200],
    ["a broken body", "secret upstream text", 200],
  ] as const)("does not leak the upstream body in the error message on %s", async (_case, body, status) => {
    vi.stubGlobal("fetch", respond(body, status));
    const error = await fetchJson("/pokemon/25", schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as Error).message).toContain("/pokemon/25");
    expect((error as Error).message).not.toContain("secret upstream text");
  });
});
