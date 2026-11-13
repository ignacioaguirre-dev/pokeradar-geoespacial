import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchPokeApi } from "./pokeapi";

// The fetch behaviour itself is covered in src/lib/upstream; this only pins PokéAPI's settings.
const schema = z.object({ name: z.string() });

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ name: "pikachu" })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const urlFor = async (base: string | undefined) => {
  vi.stubEnv("POKEAPI_BASE_URL", base);
  const fetchMock = stubFetch();
  await fetchPokeApi("/pokemon/25", schema);
  return fetchMock.mock.calls[0][0];
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchPokeApi", () => {
  it("uses the public PokéAPI by default", async () => {
    expect(await urlFor(undefined)).toBe("https://pokeapi.co/api/v2/pokemon/25");
  });

  it("uses POKEAPI_BASE_URL when set", async () => {
    expect(await urlFor("http://localhost:4010")).toBe("http://localhost:4010/pokemon/25");
  });

  it("falls back to the public PokéAPI when POKEAPI_BASE_URL is empty", async () => {
    expect(await urlFor("")).toBe("https://pokeapi.co/api/v2/pokemon/25");
  });

  it("drops a trailing slash from POKEAPI_BASE_URL", async () => {
    expect(await urlFor("http://localhost:4010/")).toBe("http://localhost:4010/pokemon/25");
  });

  it("gives up after 8 seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    stubFetch();
    await fetchPokeApi("/pokemon/25", schema);
    expect(timeout).toHaveBeenCalledWith(8000);
  });
});
