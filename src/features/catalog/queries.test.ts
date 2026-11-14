import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import habitatsFixture from "./__fixtures__/habitats.json";
import pokemonFixture from "./__fixtures__/pokemon-25.json";
import speciesFixture from "./__fixtures__/species-25.json";
import typesFixture from "./__fixtures__/types.json";
import { cacheLife } from "next/cache";
import type { Loaded } from "@/lib/upstream/result";
import { loadCatalog, loadCreature } from "./queries";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const BASE = "https://pokeapi.co/api/v2";
const clone = <T>(value: T): T => structuredClone(value);

type Routes = Record<string, () => Response>;
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });

function serve(routes: Routes) {
  const fetchMock = vi.fn(async (url: string) => {
    const route = routes[url.replace(BASE, "")];
    return route ? route() : new Response("Not Found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function catalogRoutes(habitats = clone(habitatsFixture), types = clone(typesFixture)): Routes {
  const routes: Routes = {};
  habitats.forEach((h, i) => (routes[`/pokemon-habitat/${i + 1}`] = json(h)));
  types.forEach((t, i) => (routes[`/type/${i + 1}`] = json(t)));
  return routes;
}

const dataOf = async <T>(promise: Promise<Loaded<T>>): Promise<T> => {
  const loaded = await promise;
  if (!loaded.ok) throw new Error(`expected data, got ${loaded.kind}`);
  return loaded.data;
};

const kindOf = async (promise: Promise<Loaded<unknown>>) => {
  const loaded = await promise;
  expect(loaded.ok).toBe(false);
  return loaded.ok ? undefined : loaded.kind;
};

beforeEach(() => vi.stubEnv("POKEAPI_BASE_URL", undefined));
afterEach(() => {
  vi.mocked(cacheLife).mockClear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("loadCatalog", () => {
  it("builds the 386 species sorted by id with habitat and slot-ordered types", async () => {
    const fetchMock = serve(catalogRoutes());
    const catalog = await dataOf(loadCatalog());

    expect(fetchMock).toHaveBeenCalledTimes(27);
    expect(catalog).toHaveLength(386);
    expect(catalog.map((s) => s.id)).toEqual(Array.from({ length: 386 }, (_, i) => i + 1));
    expect(catalog[0]).toEqual({ id: 1, slug: "bulbasaur", habitat: "grassland", types: ["grass", "poison"] });
    expect(catalog[24]).toEqual({ id: 25, slug: "pikachu", habitat: "forest", types: ["electric"] });
    expect(catalog[5]).toEqual({ id: 6, slug: "charizard", habitat: "mountain", types: ["fire", "flying"] });
  });

  it("orders types by slot even when the secondary type is listed first", async () => {
    const types = clone(typesFixture);
    // Move poison (slot 2 for bulbasaur) ahead of grass in request order.
    const poison = types.findIndex((t) => t.name === "poison");
    const [moved] = types.splice(poison, 1);
    types.unshift(moved);
    serve(catalogRoutes(undefined, types));
    const catalog = await dataOf(loadCatalog());
    expect(catalog[0].types).toEqual(["grass", "poison"]);
  });

  it("ignores type entries for ids above 386", async () => {
    const beyond = typesFixture
      .flatMap((t) => t.pokemon)
      .filter((p) => Number(/\/(\d+)\/$/.exec(p.pokemon.url)![1]) > 386);
    expect(beyond.length).toBeGreaterThan(0);
    serve(catalogRoutes());
    const catalog = await dataOf(loadCatalog());
    expect(catalog).toHaveLength(386);
    expect(catalog.every((s) => s.id <= 386)).toBe(true);
  });

  it("fails with unavailable when a habitat answers 500", async () => {
    const routes = catalogRoutes();
    routes["/pokemon-habitat/3"] = () => new Response("boom", { status: 500 });
    serve(routes);
    expect(await kindOf(loadCatalog())).toBe("unavailable");
  });

  it("fails with invalid when a habitat answers 404", async () => {
    const routes = catalogRoutes();
    delete routes["/pokemon-habitat/3"];
    serve(routes);
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when a type answers 404", async () => {
    const routes = catalogRoutes();
    delete routes["/type/7"];
    serve(routes);
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when a habitat has an unexpected shape", async () => {
    const routes = catalogRoutes();
    routes["/pokemon-habitat/3"] = json({ name: "grassland", pokemon_species: "nope" });
    serve(routes);
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when a habitat name is unknown", async () => {
    const habitats = clone(habitatsFixture);
    habitats[0].name = "volcano";
    serve(catalogRoutes(habitats));
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when the total is not 386", async () => {
    const habitats = clone(habitatsFixture);
    habitats[0].pokemon_species.pop();
    serve(catalogRoutes(habitats));
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when a species shows up in two habitats", async () => {
    const habitats = clone(habitatsFixture);
    habitats[1].pokemon_species.push(habitats[0].pokemon_species[0]);
    habitats[0].pokemon_species.splice(1, 1);
    serve(catalogRoutes(habitats));
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });

  it("fails with invalid when a species has no type", async () => {
    const types = clone(typesFixture).map((t) => ({
      ...t,
      pokemon: t.pokemon.filter((p) => !p.pokemon.url.endsWith("/pokemon/25/")),
    }));
    serve(catalogRoutes(undefined, types));
    expect(await kindOf(loadCatalog())).toBe("invalid");
  });
});

describe("loadCreature", () => {
  const creatureRoutes = (pokemon: unknown = clone(pokemonFixture), species: unknown = clone(speciesFixture)) => ({
    "/pokemon/25": json(pokemon),
    "/pokemon-species/25": json(species),
  });

  it("trims pokemon and species into the creature detail", async () => {
    const fetchMock = serve(creatureRoutes());
    const creature = await dataOf(loadCreature(25));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(creature).toEqual({
      id: 25,
      name: "Pikachu",
      types: ["electric"],
      stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      heightM: 0.4,
      weightKg: 6,
      sprite: {
        animated:
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif",
        still: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      },
      cry: "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg",
      flavor:
        "Los miembros de esta especie se saludan entre sí uniendo sus colas y transmitiéndose corriente eléctrica.",
    });
  });

  it("converts decimetres and hectograms without float noise", async () => {
    const pokemon = { ...clone(pokemonFixture), height: 17, weight: 905 };
    serve(creatureRoutes(pokemon));
    const creature = await dataOf(loadCreature(25));
    expect(creature.heightM).toBe(1.7);
    expect(creature.weightKg).toBe(90.5);
  });

  it("falls back to English name and flavor when Spanish is missing", async () => {
    const species = clone(speciesFixture);
    species.names = species.names.filter((n) => n.language.name !== "es");
    species.names.find((n) => n.language.name === "en")!.name = "Pikachu EN";
    species.flavor_text_entries = [
      { flavor_text: "When several of\nthese POKéMON\fgather, their elec\u00ad\ntricity could build.", language: { name: "en" } },
    ];
    serve(creatureRoutes(undefined, species));
    const creature = await dataOf(loadCreature(25));
    expect(creature.name).toBe("Pikachu EN");
    expect(creature.flavor).toBe("When several of these POKéMON gather, their electricity could build.");
  });

  it("uses the slug and a null flavor when no name or text is in es or en", async () => {
    const species = { ...clone(speciesFixture), names: [], flavor_text_entries: [] };
    serve(creatureRoutes(undefined, species));
    const creature = await dataOf(loadCreature(25));
    expect(creature.name).toBe("pikachu");
    expect(creature.flavor).toBeNull();
  });

  it("removes line breaks and form feeds from the flavor text", async () => {
    serve(creatureRoutes());
    const { flavor } = await dataOf(loadCreature(25));
    expect(flavor).not.toMatch(/[\n\f\r]/);
    expect(flavor).not.toMatch(/ {2}/);
  });

  it("returns a null animated sprite and cry when they are missing", async () => {
    const pokemon = clone(pokemonFixture) as Record<string, unknown>;
    pokemon.sprites = { front_default: "https://example.test/25.png", versions: {} };
    pokemon.cries = { latest: null };
    serve(creatureRoutes(pokemon));
    const creature = await dataOf(loadCreature(25));
    expect(creature.sprite).toEqual({ animated: null, still: "https://example.test/25.png" });
    expect(creature.cry).toBeNull();
  });

  it("orders types by slot", async () => {
    const pokemon = {
      ...clone(pokemonFixture),
      types: [
        { slot: 2, type: { name: "flying" } },
        { slot: 1, type: { name: "fire" } },
      ],
    };
    serve(creatureRoutes(pokemon));
    expect((await dataOf(loadCreature(25))).types).toEqual(["fire", "flying"]);
  });

  it("fails with not-found when PokéAPI answers 404", async () => {
    serve({});
    expect(await kindOf(loadCreature(25))).toBe("not-found");
  });

  it("fails with invalid when a stat is missing", async () => {
    const pokemon = clone(pokemonFixture);
    pokemon.stats = pokemon.stats.filter((s) => s.stat.name !== "speed");
    serve(creatureRoutes(pokemon));
    expect(await kindOf(loadCreature(25))).toBe("invalid");
  });

  it("fails with unavailable when the species endpoint fails", async () => {
    serve({ ...creatureRoutes(), "/pokemon-species/25": () => new Response("boom", { status: 503 }) });
    expect(await kindOf(loadCreature(25))).toBe("unavailable");
  });
});

describe("cache lifetime", () => {
  it("caches a successful catalog for days and a failed one for seconds", async () => {
    serve(catalogRoutes());
    await loadCatalog();
    serve({});
    await loadCatalog();
    expect(vi.mocked(cacheLife).mock.calls).toEqual([["days"], ["seconds"]]);
  });

  it("caches a successful creature for weeks and a failed one for seconds", async () => {
    serve({ "/pokemon/25": json(pokemonFixture), "/pokemon-species/25": json(speciesFixture) });
    await loadCreature(25);
    serve({ "/pokemon/25": () => new Response("boom", { status: 500 }) });
    await loadCreature(25);
    expect(vi.mocked(cacheLife).mock.calls).toEqual([["weeks"], ["seconds"]]);
  });
});
