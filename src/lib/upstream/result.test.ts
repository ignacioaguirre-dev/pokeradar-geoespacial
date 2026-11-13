import { cacheLife } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "./errors";
import { cacheFor, settle } from "./result";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

afterEach(() => vi.mocked(cacheLife).mockClear());

describe("settle", () => {
  it("wraps a successful load", async () => {
    await expect(settle(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it.each(["not-found", "unavailable", "invalid"] as const)("turns an UpstreamError %s into a value", async (kind) => {
    await expect(
      settle(async () => {
        throw new UpstreamError(kind, "/x: detail");
      }),
    ).resolves.toEqual({ ok: false, kind });
  });

  it("rethrows any other error: it is a bug, not an upstream failure", async () => {
    const bug = new TypeError("bug");
    await expect(
      settle(async () => {
        throw bug;
      }),
    ).rejects.toBe(bug);
  });
});

describe("cacheFor", () => {
  it.each(["minutes", "hours", "days", "weeks"] as const)("caches a success for %s", (profile) => {
    cacheFor({ ok: true, data: null }, profile);
    expect(vi.mocked(cacheLife).mock.calls).toEqual([[profile]]);
  });

  it("caches a failure for seconds whatever the success profile", () => {
    cacheFor({ ok: false, kind: "unavailable" }, "weeks");
    expect(vi.mocked(cacheLife).mock.calls).toEqual([["seconds"]]);
  });
});
