import { describe, expect, it } from "vitest";
import { invalidInput, upstreamFailure } from "./response";

describe("upstreamFailure", () => {
  it.each([
    ["not-found", 404],
    ["unavailable", 502],
    ["invalid", 502],
  ] as const)("answers %s with %i and no-store", async (kind, status) => {
    const response = upstreamFailure(kind);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("invalidInput", () => {
  it("answers 400 with the code and no-store", async () => {
    const response = invalidInput("invalid-id");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-id" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
