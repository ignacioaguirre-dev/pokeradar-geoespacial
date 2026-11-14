import { describe, expect, it } from "vitest";
import { draftCollection } from "./fence-draft";

const parts = (ring: Parameters<typeof draftCollection>[0]) =>
  draftCollection(ring).features.map((f) => f.properties.part);

describe("draftCollection", () => {
  it("is empty with no vertex", () => {
    expect(draftCollection([]).features).toEqual([]);
  });

  it("one vertex is a dot, two are an edge", () => {
    expect(parts([[-60, -30]])).toEqual(["vertex"]);
    expect(parts([[-60, -30], [-59, -30]])).toEqual(["edge", "vertex", "vertex"]);
  });

  it("from three vertices adds the edge that would close it, back to the first", () => {
    const ring = [[-60, -30], [-59, -30], [-59, -29]] as const;
    const collection = draftCollection(ring);
    expect(parts(ring)).toEqual(["edge", "closing", "vertex", "vertex", "vertex"]);
    expect(collection.features[0].geometry.coordinates).toEqual([[-60, -30], [-59, -30], [-59, -29]]);
    expect(collection.features[1].geometry.coordinates).toEqual([[-59, -29], [-60, -30]]);
  });
});
