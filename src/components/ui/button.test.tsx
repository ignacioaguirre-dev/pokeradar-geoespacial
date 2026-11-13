import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import { Button } from "./button";

describe("Button", () => {
  it("is found by role and name and fires the click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("with a reason it does not fire, stays focusable and shows the reason as its description", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabledReason="Faltan 2 vértices">
        Crear cerca
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Crear cerca" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Faltan 2 vértices");
    expect(screen.getByText("Faltan 2 vértices")).toBeVisible();
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the caller's aria-describedby next to the reason", () => {
    render(
      <>
        <p id="help">Ayuda extra</p>
        <Button aria-describedby="help" disabledReason="Faltan 2 vértices">
          Crear
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Crear" })).toHaveAccessibleDescription(
      "Ayuda extra Faltan 2 vértices",
    );
  });

  it("keeps focus when the reason appears and disappears", () => {
    const { rerender } = render(<Button>Crear</Button>);
    const button = screen.getByRole("button", { name: "Crear" });
    button.focus();
    rerender(<Button disabledReason="Faltan 2 vértices">Crear</Button>);
    expect(screen.getByRole("button", { name: "Crear" })).toBe(button);
    expect(button).toHaveFocus();
    rerender(<Button>Crear</Button>);
    expect(screen.getByRole("button", { name: "Crear" })).toBe(button);
    expect(button).toHaveFocus();
  });

  it("while loading it sets aria-busy, announces the catalog label and does not fire", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Buscar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Buscar" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    // The label stays on screen next to the spinner
    expect(screen.getByText("Buscar")).toBeVisible();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("a custom loading label replaces the default one", () => {
    render(
      <Button loading loadingLabel="Guardando la cerca">
        Guardar
      </Button>,
    );
    expect(screen.getByText("Guardando la cerca")).toBeInTheDocument();
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument();
  });

  it("with native disabled it does not fire", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Borrar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Borrar" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
