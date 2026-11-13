import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Quantity } from "./quantity";

describe("Quantity", () => {
  it("formats in es-AR with the requested decimals", () => {
    render(<Quantity value={1234.5} decimals={1} />);
    expect(screen.getByText("1.234,5")).toBeInTheDocument();
  });

  it("appends the unit", () => {
    render(<Quantity value={1234.5} decimals={1} unit="km²" />);
    expect(screen.getByText("1.234,5 km²")).toBeInTheDocument();
  });

  it("rounds to an integer without decimals", () => {
    render(<Quantity value={84} />);
    expect(screen.getByText("84")).toBeInTheDocument();
  });

  it("exposes the raw value for machines", () => {
    render(<Quantity value={1234.5} decimals={1} unit="km²" />);
    expect(screen.getByText("1.234,5 km²")).toHaveAttribute("value", "1234.5");
  });
});
