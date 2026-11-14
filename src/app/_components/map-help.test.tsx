import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/testing/render";
import { introLines, MapHelpButton, type MapHelpButtonHandle, MapHelpIntro, panelLines } from "./map-help";

const TOUCH = "Arrastrá con un dedo para moverte · Pellizcá para acercar o alejar";
const TOUCHPAD = "Touchpad: dos dedos para moverte · pellizcá para acercar";
const MOUSE = "Mouse: arrastrá para moverte · rueda para acercar";
const KEYBOARD = "Teclado: flechas para moverte · + y − para acercar";

describe("introLines", () => {
  it("shows touch on a phone, the desktop inputs on a computer and both on a touch-screen laptop", () => {
    expect(introLines("coarse")).toEqual(["touch"]);
    expect(introLines("fine")).toEqual(["touchpad", "mouse", "keyboard"]);
    expect(introLines("hybrid")).toEqual(["touchpad", "mouse", "keyboard", "touch"]);
  });
});

describe("panelLines", () => {
  it("lists every input, with the device's group first", () => {
    expect(panelLines("coarse", null)).toEqual(["touch", "touchpad", "mouse", "keyboard"]);
    expect(panelLines("fine", null)).toEqual(["touchpad", "mouse", "keyboard", "touch"]);
    expect(panelLines(null, null)).toEqual(["touchpad", "mouse", "keyboard", "touch"]);
  });

  it("puts the input the map detected first", () => {
    expect(panelLines("fine", "mouse")).toEqual(["mouse", "touchpad", "keyboard", "touch"]);
    expect(panelLines("hybrid", "touch")).toEqual(["touch", "touchpad", "mouse", "keyboard"]);
    expect(panelLines("coarse", "touchpad")).toEqual(["touchpad", "touch", "mouse", "keyboard"]);
  });
});

describe("MapHelpIntro", () => {
  it("is a status with the lines in order and a dismiss button", async () => {
    const onDismiss = vi.fn();
    render(<MapHelpIntro lines={["touchpad", "mouse", "keyboard"]} onDismiss={onDismiss} />);
    const status = screen.getByRole("status");
    expect(within(status).getAllByRole("listitem").map((item) => item.textContent)).toEqual([TOUCHPAD, MOUSE, KEYBOARD]);
    await userEvent.click(within(status).getByRole("button", { name: "Entendido" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows only the touch line on a phone", () => {
    render(<MapHelpIntro lines={["touch"]} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(TOUCH);
    expect(screen.queryByText(TOUCHPAD)).not.toBeInTheDocument();
  });
});

describe("MapHelpButton", () => {
  const lines = () => ["mouse", "touchpad", "keyboard", "touch"] as const;

  function panel() {
    return screen.queryByRole("region", { name: "Cómo moverse" });
  }

  it("opens the help with the lines in the given order", async () => {
    render(<MapHelpButton lines={lines} />);
    const button = screen.getByRole("button", { name: "Cómo moverse" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const open = panel();
    if (!open) throw new Error("the help did not open");
    expect(within(open).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      MOUSE,
      TOUCHPAD,
      KEYBOARD,
      TOUCH,
    ]);
  });

  it("closes with Escape and gives the focus back to the button", async () => {
    render(<MapHelpButton lines={lines} />);
    const button = screen.getByRole("button", { name: "Cómo moverse" });
    await userEvent.click(button);
    screen.getByRole("button", { name: "Cerrar" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(panel()).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes with Cerrar and gives the focus back to the button", async () => {
    render(<MapHelpButton lines={lines} />);
    const button = screen.getByRole("button", { name: "Cómo moverse" });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(panel()).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  // DESIGN.md: never an icon alone
  it("shows its name as visible text", () => {
    render(<MapHelpButton lines={lines} />);
    expect(screen.getByRole("button", { name: "Cómo moverse" })).toHaveTextContent("Cómo moverse");
  });

  // What the map detected changes during gestures; reading it on open keeps those gestures from re-rendering
  it("reads the lines when it opens, not before", async () => {
    const read = vi.fn(lines);
    render(<MapHelpButton lines={read} />);
    expect(read).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cómo moverse" }));
    expect(read).toHaveBeenCalledOnce();
  });

  it("lets Tab go from the button into the open panel", async () => {
    render(<MapHelpButton lines={lines} />);
    await userEvent.click(screen.getByRole("button", { name: "Cómo moverse" }));
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });

  it("closes from outside without taking the focus", async () => {
    const ref = createRef<MapHelpButtonHandle>();
    render(
      <>
        <MapHelpButton ref={ref} lines={lines} />
        <button type="button">Otro</button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cómo moverse" }));
    screen.getByRole("button", { name: "Otro" }).focus();
    act(() => ref.current?.close());
    expect(panel()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otro" })).toHaveFocus();
  });

  it("stays closed while disabled", () => {
    render(<MapHelpButton lines={lines} disabled />);
    expect(screen.getByRole("button", { name: "Cómo moverse" })).toBeDisabled();
    expect(panel()).not.toBeInTheDocument();
  });
});
