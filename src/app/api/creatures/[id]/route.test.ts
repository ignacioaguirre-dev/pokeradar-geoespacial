import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCreature } from "@/features/catalog/queries";
import type { CreatureDetail } from "@/features/catalog/types";
import { GET } from "./route";

vi.mock("@/features/catalog/queries", () => ({ loadCreature: vi.fn() }));

const pikachu: CreatureDetail = {
  id: 25,
  name: "Pikachu",
  types: ["electric"],
  stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
  heightM: 0.4,
  weightKg: 6,
  sprite: { animated: "https://example.test/25.gif", still: "https://example.test/25.png" },
  cry: "https://example.test/25.ogg",
  flavor: "Texto.",
};

const call = (id: string, query = "") =>
  GET(new Request(`http://localhost/api/creatures/${id}${query}`), { params: Promise.resolve({ id }) });

afterEach(() => vi.mocked(loadCreature).mockReset());

describe("GET /api/creatures/[id]", () => {
  it.each(["0", "387", "abc", "1.5", "-1", "025", "1e2", ""])("rejects id %j with 400", async (id) => {
    const response = await call(id);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-id" });
    expect(loadCreature).not.toHaveBeenCalled();
  });

  it("answers 200 with the trimmed detail and the cache header", async () => {
    vi.mocked(loadCreature).mockResolvedValue({ ok: true, data: pikachu });
    const response = await call("25");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(pikachu);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400, s-maxage=604800");
    expect(loadCreature).toHaveBeenCalledWith(25);
  });

  it("accepts both ends of the range", async () => {
    vi.mocked(loadCreature).mockResolvedValue({ ok: true, data: pikachu });
    expect((await call("1")).status).toBe(200);
    expect((await call("386")).status).toBe(200);
  });

  it("does not forward query parameters upstream", async () => {
    vi.mocked(loadCreature).mockResolvedValue({ ok: true, data: pikachu });
    await call("25", "?path=/berry/1");
    expect(loadCreature).toHaveBeenCalledWith(25);
  });

  it.each([
    ["not-found", 404],
    ["unavailable", 502],
    ["invalid", 502],
  ] as const)("answers a failed %s load with %i", async (kind, status) => {
    vi.mocked(loadCreature).mockResolvedValue({ ok: false, kind });
    const response = await call("25");
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rethrows errors that are not from upstream", async () => {
    vi.mocked(loadCreature).mockRejectedValue(new Error("bug"));
    await expect(call("25")).rejects.toThrow("bug");
  });
});
