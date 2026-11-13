import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Cifra } from "./cifra";

describe("Cifra", () => {
  it("formatea en es-AR con los decimales pedidos", () => {
    render(<Cifra valor={1234.5} decimales={1} />);
    expect(screen.getByText("1.234,5")).toBeInTheDocument();
  });

  it("agrega la unidad", () => {
    render(<Cifra valor={1234.5} decimales={1} unidad="km²" />);
    expect(screen.getByText("1.234,5 km²")).toBeInTheDocument();
  });

  it("sin decimales redondea a entero", () => {
    render(<Cifra valor={84} />);
    expect(screen.getByText("84")).toBeInTheDocument();
  });

  it("expone el valor sin formato para las máquinas", () => {
    render(<Cifra valor={1234.5} decimales={1} unidad="km²" />);
    expect(screen.getByText("1.234,5 km²")).toHaveAttribute("value", "1234.5");
  });
});
