import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/testing/render";
import { Sheet } from "./sheet";

// An opener outside the sheet, as the control column has
function Harness({ initial = false }) {
  const [open, setOpen] = useState(initial);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} onClick={() => setOpen(true)}>
        Hábitats
      </button>
      <Sheet open={open} title="Hábitats" close={<button onClick={() => setOpen(false)}>Cerrar</button>} onClose={() => setOpen(false)} returnFocus={() => opener.current}>
        <a href="#bosque">Bosque</a>
      </Sheet>
    </>
  );
}

async function openSheet() {
  render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Hábitats" }));
  return screen.getByRole("dialog", { name: "Hábitats" });
}

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a modal dialog named by its title, with the focus inside", async () => {
    const sheet = await openSheet();
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveFocus();
    expect(screen.getByRole("link", { name: "Bosque" })).toBeVisible();
  });

  it("Cerrar closes it and gives the focus back to the opener", async () => {
    await openSheet();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Hábitats" })).toHaveFocus();
  });

  it("Escape closes it and gives the focus back to the opener", async () => {
    await openSheet();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Hábitats" })).toHaveFocus();
  });

  it("keeps the focus inside while open", async () => {
    await openSheet();
    const link = screen.getByRole("link", { name: "Bosque" });
    const close = screen.getByRole("button", { name: "Cerrar" });
    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it("leaves a focus taken elsewhere on purpose where it is", async () => {
    function Elsewhere() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(false)}>Ver Pikachu</button>
          <Sheet open={open} title="Hábitats" close={<button onClick={() => setOpen(false)}>Cerrar</button>} onClose={() => setOpen(false)} returnFocus={() => null}>
            <p>Bosque</p>
          </Sheet>
        </>
      );
    }
    render(<Elsewhere />);
    const other = screen.getByRole("button", { name: "Ver Pikachu", hidden: true });
    other.focus();
    await userEvent.click(other);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(other).toHaveFocus();
  });
});
