import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import { FencePicker } from "./fence-picker";

const FENCES = [
  { id: "ibera", name: "Esteros del Iberá" },
  { id: "sea", name: "Mar Argentino" },
];

describe("FencePicker", () => {
  it("lists every fence as a button under its group name, none chosen at first", () => {
    render(<FencePicker fences={FENCES} active={null} onChoose={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Cercas" });
    expect(group).toBeInTheDocument();
    for (const { name } of FENCES) {
      expect(screen.getByRole("button", { name, pressed: false })).toBeInTheDocument();
    }
  });

  it("marks the active fence as pressed", () => {
    render(<FencePicker fences={FENCES} active="sea" onChoose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Mar Argentino", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esteros del Iberá", pressed: false })).toBeInTheDocument();
  });

  it("chooses a fence with a tap or from the keyboard", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<FencePicker fences={FENCES} active={null} onChoose={onChoose} />);
    await user.click(screen.getByRole("button", { name: "Esteros del Iberá" }));
    expect(onChoose).toHaveBeenLastCalledWith("ibera");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith("sea");
  });
});
