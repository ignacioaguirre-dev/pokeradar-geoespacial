import { describe, expect, it } from "vitest";
import messages from "../../../messages/es-AR.json";
import { HABITATS, TYPE_NAMES } from "./types";

// Every type and habitat the catalog can return needs a Spanish label.
describe("catalog messages", () => {
  it("has a label for each of the 18 types", () => {
    expect(Object.keys(messages.Types).sort()).toEqual([...TYPE_NAMES].sort());
  });

  it("has a label for each of the 9 habitats", () => {
    expect(Object.keys(messages.Habitats).sort()).toEqual([...HABITATS].sort());
  });
});
