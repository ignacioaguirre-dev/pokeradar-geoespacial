// Stands in for PokéAPI during E2E runs, so no test depends on the real service.
// Serves the full catalog (9 habitats, 18 types, the 386 species) from the unit-test fixtures, so the sweep
// detects real creatures. Pikachu (25) is the real detail; every other species gets Pikachu's shape under its
// own id and name. 26 fails on purpose and anything outside the catalog answers 404.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 3101);
const fixtures = join(import.meta.dirname, "..", "..", "src", "features", "catalog", "__fixtures__");
const read = (name) => JSON.parse(readFileSync(join(fixtures, name), "utf8"));

// The trimmed listings keep PokéAPI's order, which is the id order the catalog asks for
const habitats = read("habitats.json");
const types = read("types.json");
const pikachu = read("pokemon-25.json");
const pikachuSpecies = read("species-25.json");

const SPECIES_COUNT = 386;
const slugs = new Map(
  habitats.flatMap((habitat) =>
    habitat.pokemon_species.map((species) => [Number(/\/(\d+)\/$/.exec(species.url)[1]), species.name]),
  ),
);
const capitalized = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);

function pokemon(id) {
  if (id === 25) return pikachu;
  return { ...pikachu, id, name: slugs.get(id) };
}

function species(id) {
  if (id === 25) return pikachuSpecies;
  return {
    ...pikachuSpecies,
    names: [{ language: { name: "es" }, name: capitalized(slugs.get(id)) }],
  };
}

// Upstream outage for one creature, to exercise the error and retry path
const FAILING = /^\/(pokemon|pokemon-species)\/26$/;
const LISTING = /^\/(pokemon-habitat|type)\/(\d+)$/;
const DETAIL = /^\/(pokemon|pokemon-species)\/(\d+)$/;

function route(path) {
  const listing = LISTING.exec(path);
  if (listing) {
    const list = listing[1] === "type" ? types : habitats;
    return list[Number(listing[2]) - 1];
  }
  const detail = DETAIL.exec(path);
  if (detail) {
    const id = Number(detail[2]);
    if (id < 1 || id > SPECIES_COUNT) return undefined;
    return detail[1] === "pokemon" ? pokemon(id) : species(id);
  }
  return undefined;
}

createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/$/, "");
  if (path === "/health") {
    response.writeHead(200).end("ok");
    return;
  }
  if (FAILING.test(path)) {
    response.writeHead(500, { "Content-Type": "application/json" }).end('{"detail":"fixture failure"}');
    return;
  }
  const body = route(path);
  if (body) {
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  } else {
    response.writeHead(404, { "Content-Type": "application/json" }).end('{"detail":"Not found."}');
  }
}).listen(port, () => console.log(`pokeapi fixtures on http://localhost:${port}`));
