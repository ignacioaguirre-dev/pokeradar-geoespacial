// No zod here: client components import these without pulling the validator into the bundle.
import { HABITATS, type Habitat } from "@/domain/habitat/types";

// The habitat list lives in domain, shared with the static data and the map.
export { HABITATS, type Habitat };

export const TYPE_NAMES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
  "fairy",
] as const;

// Only Gen I–III species have a habitat in PokéAPI.
export const SPECIES_COUNT = 386;

export type TypeName = (typeof TYPE_NAMES)[number];

export type Species = { id: number; slug: string; habitat: Habitat; types: TypeName[] };
export type Catalog = Species[];

export type CreatureDetail = {
  id: number;
  name: string;
  types: TypeName[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  heightM: number;
  weightKg: number;
  sprite: { animated: string | null; still: string };
  cry: string | null;
  flavor: string | null;
};
