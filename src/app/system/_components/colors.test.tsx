import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/testing/render";
import { Colors } from "./colors";

function rowOf(token: string): HTMLElement {
  return screen.getByText(token, { selector: "code" }).closest("li") as HTMLElement;
}

describe("Colors", () => {
  it("names each token's origin and usage from the catalog", () => {
    render(<Colors />);
    const foreground = within(rowOf("foreground"));
    expect(foreground.getByText("Sal de Salinas Grandes")).toBeInTheDocument();
    expect(foreground.getByText("Texto · mín. 4,5")).toBeInTheDocument();
    expect(within(rowOf("energy")).getByText("Gráfico · mín. 3")).toBeInTheDocument();
    expect(within(rowOf("structure")).getByText("Decorativo")).toBeInTheDocument();
  });

  it("lists the biome colors of the map with their origin", () => {
    render(<Colors />);
    const forest = within(rowOf("biome-forest"));
    expect(forest.getByText("Selva de las yungas salteñas")).toBeInTheDocument();
    expect(forest.getByText("Decorativo")).toBeInTheDocument();
    for (const name of ["grassland", "waters-edge", "mountain", "rough-terrain", "sea"]) {
      expect(rowOf(`biome-${name}`)).toBeInTheDocument();
    }
  });
});
