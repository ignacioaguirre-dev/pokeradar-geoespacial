import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnergyBar } from "./energy-bar";

describe("EnergyBar", () => {
  it("exposes a meter with name, value and range", () => {
    render(<EnergyBar label="Ataque" value={84} max={255} />);
    const meter = screen.getByRole("meter", { name: "Ataque" });
    expect(meter).toBeInstanceOf(HTMLMeterElement);
    expect(meter).toHaveProperty("value", 84);
    expect(meter).toHaveProperty("min", 0);
    expect(meter).toHaveProperty("max", 255);
    expect(screen.getByText("84")).toBeVisible();
  });

  it("ties the visible label to the meter", () => {
    render(<EnergyBar label="Ataque" value={84} max={255} />);
    expect(screen.getByLabelText("Ataque")).toBe(screen.getByRole("meter"));
  });

  it("clamps the value to the range", () => {
    const { rerender } = render(<EnergyBar label="Ataque" value={300} max={255} />);
    expect(screen.getByRole("meter", { name: "Ataque" })).toHaveProperty("value", 255);
    rerender(<EnergyBar label="Ataque" value={-5} max={255} />);
    expect(screen.getByRole("meter", { name: "Ataque" })).toHaveProperty("value", 0);
  });
});
