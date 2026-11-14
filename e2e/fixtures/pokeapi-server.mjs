// Stands in for PokéAPI during E2E runs, so no test depends on the real service.
// Serves Pikachu (25) from the unit-test fixtures, fails on purpose for 26 and answers 404 for the rest.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number(process.env.PORT ?? 3101);
const fixtures = join(import.meta.dirname, "..", "..", "src", "features", "catalog", "__fixtures__");

const routes = {
  "/pokemon/25": readFileSync(join(fixtures, "pokemon-25.json")),
  "/pokemon-species/25": readFileSync(join(fixtures, "species-25.json")),
};
// Upstream outage for one creature, to exercise the error and retry path
const FAILING = /^\/(pokemon|pokemon-species)\/26\/?$/;

createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/$/, "");
  if (path === "/health") {
    response.writeHead(200).end("ok");
  } else if (FAILING.test(path)) {
    response.writeHead(500, { "Content-Type": "application/json" }).end('{"detail":"fixture failure"}');
  } else if (routes[path]) {
    response.writeHead(200, { "Content-Type": "application/json" }).end(routes[path]);
  } else {
    response.writeHead(404, { "Content-Type": "application/json" }).end('{"detail":"Not found."}');
  }
}).listen(port, () => console.log(`pokeapi fixtures on http://localhost:${port}`));
