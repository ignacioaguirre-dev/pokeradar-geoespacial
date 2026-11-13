import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Boton } from "./boton";

describe("Boton", () => {
  it("se encuentra por rol y nombre y dispara el click", async () => {
    const alClick = vi.fn();
    render(<Boton onClick={alClick}>Guardar</Boton>);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(alClick).toHaveBeenCalledTimes(1);
  });

  it("con motivo no dispara, sigue enfocable y muestra el motivo como descripción", async () => {
    const alClick = vi.fn();
    render(
      <Boton onClick={alClick} motivoDeshabilitado="Faltan 2 vértices">
        Crear cerca
      </Boton>,
    );
    const boton = screen.getByRole("button", { name: "Crear cerca" });
    expect(boton).toHaveAttribute("aria-disabled", "true");
    expect(boton).toHaveAccessibleDescription("Faltan 2 vértices");
    expect(screen.getByText("Faltan 2 vértices")).toBeVisible();
    await userEvent.click(boton);
    boton.focus();
    await userEvent.keyboard("{Enter}");
    expect(boton).toHaveFocus();
    expect(alClick).not.toHaveBeenCalled();
  });

  it("conserva el aria-describedby del llamador junto al motivo", () => {
    render(
      <>
        <p id="ayuda">Ayuda extra</p>
        <Boton aria-describedby="ayuda" motivoDeshabilitado="Faltan 2 vértices">
          Crear
        </Boton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Crear" })).toHaveAccessibleDescription(
      "Ayuda extra Faltan 2 vértices",
    );
  });

  it("conserva el foco cuando aparece y desaparece el motivo", () => {
    const { rerender } = render(<Boton>Crear</Boton>);
    const boton = screen.getByRole("button", { name: "Crear" });
    boton.focus();
    rerender(<Boton motivoDeshabilitado="Faltan 2 vértices">Crear</Boton>);
    expect(screen.getByRole("button", { name: "Crear" })).toBe(boton);
    expect(boton).toHaveFocus();
    rerender(<Boton>Crear</Boton>);
    expect(screen.getByRole("button", { name: "Crear" })).toBe(boton);
    expect(boton).toHaveFocus();
  });

  it("cargando marca aria-busy y no dispara", async () => {
    const alClick = vi.fn();
    render(
      <Boton onClick={alClick} cargando>
        Buscar
      </Boton>,
    );
    const boton = screen.getByRole("button", { name: "Buscar" });
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(boton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    // The label stays on screen next to the spinner
    expect(screen.getByText("Buscar")).toBeVisible();
    await userEvent.click(boton);
    expect(alClick).not.toHaveBeenCalled();
  });

  it("con disabled nativo no dispara", async () => {
    const alClick = vi.fn();
    render(
      <Boton onClick={alClick} disabled>
        Borrar
      </Boton>,
    );
    const boton = screen.getByRole("button", { name: "Borrar" });
    expect(boton).toBeDisabled();
    await userEvent.click(boton);
    expect(alClick).not.toHaveBeenCalled();
  });
});
