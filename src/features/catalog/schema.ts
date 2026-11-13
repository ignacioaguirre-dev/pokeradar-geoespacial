import { z } from "zod";
import { HABITATS, TYPE_NAMES } from "./types";

// PokéAPI shapes, limited to the fields we read.

const namedResource = z.object({ name: z.string(), url: z.string() });
const language = z.object({ language: z.object({ name: z.string() }) });

export const habitatResponse = z.object({
  name: z.enum(HABITATS),
  pokemon_species: z.array(namedResource),
});

export const typeResponse = z.object({
  name: z.enum(TYPE_NAMES),
  pokemon: z.array(z.object({ slot: z.number().int(), pokemon: namedResource })),
});

export const pokemonResponse = z.object({
  id: z.number().int(),
  name: z.string(),
  height: z.number(),
  weight: z.number(),
  types: z.array(z.object({ slot: z.number().int(), type: z.object({ name: z.enum(TYPE_NAMES) }) })).min(1),
  stats: z.array(z.object({ base_stat: z.number(), stat: z.object({ name: z.string() }) })),
  sprites: z.object({
    front_default: z.string(),
    versions: z
      .object({
        "generation-v": z
          .object({
            "black-white": z
              .object({ animated: z.object({ front_default: z.string().nullish() }).nullish() })
              .nullish(),
          })
          .nullish(),
      })
      .nullish(),
  }),
  cries: z.object({ latest: z.string().nullish() }).nullish(),
});

export const speciesResponse = z.object({
  names: z.array(language.extend({ name: z.string() })),
  flavor_text_entries: z.array(language.extend({ flavor_text: z.string() })),
});

export type HabitatResponse = z.infer<typeof habitatResponse>;
export type TypeResponse = z.infer<typeof typeResponse>;
export type PokemonResponse = z.infer<typeof pokemonResponse>;
export type SpeciesResponse = z.infer<typeof speciesResponse>;
