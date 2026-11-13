import { createJsonFetcher } from "@/lib/upstream/fetch-json";

const DEFAULT_BASE_URL = "https://pokeapi.co/api/v2";

export const fetchPokeApi = createJsonFetcher({
  // Overridable so E2E runs can point at a fixtures server instead of the real API.
  // An empty value (as left by a blank .env line) counts as unset.
  baseUrl: () => (process.env.POKEAPI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
  timeoutMs: 8000,
});
