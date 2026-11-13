import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/testing/render";
import { HabitatLegend } from "./habitat-legend";

const PAINTED = ["Bosque", "Pradera", "Orilla del agua", "Montaña", "Terreno agreste", "Mar"];

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
});
