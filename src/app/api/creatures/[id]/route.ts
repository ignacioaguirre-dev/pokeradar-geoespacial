import { loadCreature } from "@/features/catalog/queries";
import { SPECIES_COUNT } from "@/features/catalog/types";
import { invalidInput, upstreamFailure } from "@/lib/upstream/response";

const ID_PATTERN = /^[1-9]\d*$/;

// Only the path id is read: nothing from the request reaches PokéAPI, so this is not an open proxy.
export async function GET(_request: Request, { params }: RouteContext<"/api/creatures/[id]">) {
  const { id: raw } = await params;
  const id = ID_PATTERN.test(raw) ? Number(raw) : NaN;
  if (!(id >= 1 && id <= SPECIES_COUNT)) return invalidInput("invalid-id");

  const loaded = await loadCreature(id);
  if (!loaded.ok) return upstreamFailure(loaded.kind);
  return Response.json(loaded.data, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
