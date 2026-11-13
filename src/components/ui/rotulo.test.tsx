import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rotulo } from "./rotulo";

function marca(container: HTMLElement): string {
  return container.querySelector('[aria-hidden="true"]')?.textContent ?? "";
}

describe("Rotulo", () => {
  it("muestra el texto", () => {
    render(<Rotulo variante="habitat">Bosque</Rotulo>);
    expect(screen.getByText("Bosque")).toBeInTheDocument();
  });

  it("distingue las variantes por la marca y no sólo por el color", () => {
    const marcas = (["habitat", "condicion", "neutro"] as const).map((v) => {
      const { container, unmount } = render(<Rotulo variante={v}>X</Rotulo>);
      const m = marca(container);
      unmount();
      return m;
    });
    expect(marcas.every((m) => m.length > 0)).toBe(true);
    expect(new Set(marcas).size).toBe(3);
  });
});
