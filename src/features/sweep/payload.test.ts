import { describe, expect, it } from "vitest";
import type { Species } from "@/features/catalog/types";
import { sweepPayload } from "./payload";

const species = (id: number, slug: string): Species => ({ id, slug, habitat: "forest", types: ["grass"] });
const SIGHTINGS = [{ speciesId: 2, point: [-57.5, -28.5] as const }];

describe("sweepPayload", () => {
  it("compacts the sightings and lists the slugs by species id", () => {
    expect(sweepPayload(SIGHTINGS, [species(1, "bulbasaur"), species(2, "ivysaur")])).toEqual({
      sightings: [[2, -57.5, -28.5]],
      slugs: ["bulbasaur", "ivysaur"],
    });
  });

  // The client names creature n with slugs[n - 1]: any other order would name them wrong
  it("refuses a catalog out of order", () => {
    expect(sweepPayload(SIGHTINGS, [species(2, "ivysaur"), species(1, "bulbasaur")])).toBeNull();
  });

  it("refuses a catalog with a gap", () => {
    expect(sweepPayload(SIGHTINGS, [species(1, "bulbasaur"), species(3, "venusaur")])).toBeNull();
  });
});
