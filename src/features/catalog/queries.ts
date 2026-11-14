import "server-only";
import type { z } from "zod";
import { UpstreamError } from "@/lib/upstream/errors";
import { cacheFor, settle, type Loaded } from "@/lib/upstream/result";
import { fetchPokeApi } from "./pokeapi";
import {
  habitatResponse,
  pokemonResponse,
  speciesResponse,
  typeResponse,
  type PokemonResponse,
  type SpeciesResponse,
} from "./schema";
import {
  HABITATS,
  SPECIES_COUNT,
  TYPE_NAMES,
  type Catalog,
  type CreatureDetail,
  type Habitat,
  type TypeName,
} from "./types";

const TRAILING_ID = /\/(\d+)\/?$/;
const idFromUrl = (url: string): number => Number(TRAILING_ID.exec(url)?.[1] ?? NaN);

// Cached scopes return failures as values (see settle); the build* steps below throw UpstreamError.
export async function loadCatalog(): Promise<Loaded<Catalog>> {
  "use cache";
  const loaded = await settle(buildCatalog);
  cacheFor(loaded, "days");
  return loaded;
}

export async function loadCreature(id: number): Promise<Loaded<CreatureDetail>> {
  "use cache";
  const loaded = await settle(() => buildCreature(id));
  cacheFor(loaded, "weeks");
  return loaded;
}

// Habitat and type ids are fixed; a 404 there means PokéAPI changed shape, not a missing creature.
async function fetchListing<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  try {
    return await fetchPokeApi(path, schema);
  } catch (error) {
    if (error instanceof UpstreamError && error.kind === "not-found") {
      throw new UpstreamError("invalid", error.message);
    }
    throw error;
  }
}

async function buildCatalog(): Promise<Catalog> {
  const [habitats, types] = await Promise.all([
    Promise.all(HABITATS.map((_, i) => fetchListing(`/pokemon-habitat/${i + 1}`, habitatResponse))),
    Promise.all(TYPE_NAMES.map((_, i) => fetchListing(`/type/${i + 1}`, typeResponse))),
  ]);

  const bySpecies = new Map<number, { slug: string; habitat: Habitat }>();
  for (const habitat of habitats) {
    for (const species of habitat.pokemon_species) {
      const id = idFromUrl(species.url);
      if (!Number.isInteger(id) || id < 1 || id > SPECIES_COUNT || bySpecies.has(id)) {
        throw new UpstreamError("invalid", `habitat ${habitat.name}: unexpected species ${species.name}`);
      }
      bySpecies.set(id, { slug: species.name, habitat: habitat.name });
    }
  }
  if (bySpecies.size !== SPECIES_COUNT) {
    throw new UpstreamError("invalid", `expected ${SPECIES_COUNT} species, got ${bySpecies.size}`);
  }

  // Ids above 386 are later generations or alternate forms (10001+): not part of the catalog.
  const slotted = new Map<number, { slot: number; type: TypeName }[]>();
  for (const type of types) {
    for (const { slot, pokemon } of type.pokemon) {
      const id = idFromUrl(pokemon.url);
      if (!bySpecies.has(id)) continue;
      slotted.set(id, [...(slotted.get(id) ?? []), { slot, type: type.name }]);
    }
  }

  return [...bySpecies.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, { slug, habitat }]) => {
      const entries = slotted.get(id);
      if (!entries) throw new UpstreamError("invalid", `species ${id} has no type`);
      return { id, slug, habitat, types: entries.sort((a, b) => a.slot - b.slot).map((e) => e.type) };
    });
}

async function buildCreature(id: number): Promise<CreatureDetail> {
  const [pokemon, species] = await Promise.all([
    fetchPokeApi(`/pokemon/${id}`, pokemonResponse),
    fetchPokeApi(`/pokemon-species/${id}`, speciesResponse),
  ]);
  return toCreatureDetail(pokemon, species);
}

const STAT_KEYS = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  specialAttack: "special-attack",
  specialDefense: "special-defense",
  speed: "speed",
} as const;

function toCreatureDetail(pokemon: PokemonResponse, species: SpeciesResponse): CreatureDetail {
  const stat = (name: string) => {
    const found = pokemon.stats.find((s) => s.stat.name === name);
    if (!found) throw new UpstreamError("invalid", `pokemon ${pokemon.id}: missing stat ${name}`);
    return found.base_stat;
  };
  const stats = Object.fromEntries(
    Object.entries(STAT_KEYS).map(([key, name]) => [key, stat(name)]),
  ) as CreatureDetail["stats"];

  const flavor = pickLanguage(species.flavor_text_entries)?.flavor_text;

  return {
    id: pokemon.id,
    name: pickLanguage(species.names)?.name ?? pokemon.name,
    types: [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats,
    // PokéAPI measures in decimetres and hectograms.
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    sprite: {
      animated: pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.animated?.front_default ?? null,
      still: pokemon.sprites.front_default,
    },
    cry: pokemon.cries?.latest ?? null,
    flavor: flavor === undefined ? null : cleanFlavor(flavor),
  };
}

// Spanish first, English as fallback; the last entry is the most recent game.
function pickLanguage<T extends { language: { name: string } }>(entries: T[]): T | undefined {
  for (const lang of ["es", "en"]) {
    const matches = entries.filter((e) => e.language.name === lang);
    if (matches.length > 0) return matches[matches.length - 1];
  }
  return undefined;
}

// Game texts carry hard line breaks, form feeds and soft hyphens at line ends.
function cleanFlavor(text: string): string {
  return text.replace(/\u00ad\s*/g, "").replace(/\s+/g, " ").trim();
}
