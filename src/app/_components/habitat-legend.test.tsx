import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/testing/render";
import { HabitatLegend } from "./habitat-legend";

const PAINTED = ["Bosque", "Pradera", "Orilla", "Montaña", "Terreno agreste", "Mar"];

describe("HabitatLegend", () => {
  it("starts collapsed", () => {
    render(<HabitatLegend />);
    expect(screen.getByRole("button", { name: "Hábitats" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("names every painted habitat, never color alone", async () => {
    const user = userEvent.setup();
    render(<HabitatLegend />);
    const button = screen.getByRole("button", { name: "Hábitats" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Hábitats en el mapa" });
    expect(button).toHaveAttribute("aria-controls", list.id);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(PAINTED);
  });

  it("closes with Escape and keeps the focus on the button", async () => {
    const user = userEvent.setup();
    render(<HabitatLegend />);
    const button = screen.getByRole("button", { name: "Hábitats" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the button is pressed again", async () => {
    const user = userEvent.setup();
    render(<HabitatLegend />);
    const button = screen.getByRole("button", { name: "Hábitats" });
    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("stays shut while disabled", () => {
    render(<HabitatLegend disabled />);
    expect(screen.getByRole("button", { name: "Hábitats" })).toBeDisabled();
  });

  // Otherwise the list would pop open again by itself once the map is back
  it("forgets it was open when it gets disabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HabitatLegend />);
    await user.click(screen.getByRole("button", { name: "Hábitats" }));
    rerender(<HabitatLegend disabled />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    rerender(<HabitatLegend />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hábitats" })).toHaveAttribute("aria-expanded", "false");
  });
});
