import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarraEnergia } from "./barra-energia";

describe("BarraEnergia", () => {
  it("expone un medidor con nombre, valor y rango", () => {
    render(<BarraEnergia nombre="Ataque" valor={84} maximo={255} />);
    const medidor = screen.getByRole("meter", { name: "Ataque" });
    expect(medidor).toBeInstanceOf(HTMLMeterElement);
    expect(medidor).toHaveProperty("value", 84);
    expect(medidor).toHaveProperty("min", 0);
    expect(medidor).toHaveProperty("max", 255);
    expect(screen.getByText("84")).toBeVisible();
  });

  it("asocia la etiqueta visible con el medidor", () => {
    render(<BarraEnergia nombre="Ataque" valor={84} maximo={255} />);
    expect(screen.getByLabelText("Ataque")).toBe(screen.getByRole("meter"));
  });

  it("acota el valor al rango", () => {
    const { rerender } = render(<BarraEnergia nombre="Ataque" valor={300} maximo={255} />);
    expect(screen.getByRole("meter", { name: "Ataque" })).toHaveProperty("value", 255);
    rerender(<BarraEnergia nombre="Ataque" valor={-5} maximo={255} />);
    expect(screen.getByRole("meter", { name: "Ataque" })).toHaveProperty("value", 0);
  });
});
