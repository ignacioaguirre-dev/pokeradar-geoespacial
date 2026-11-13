import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Aviso } from "./aviso";

describe("Aviso", () => {
  it("información y éxito son status", () => {
    const { rerender } = render(<Aviso variante="informacion" titulo="Cargado" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargado");
    rerender(<Aviso variante="exito" titulo="Listo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Listo");
  });

  it("error es alert, muestra título y detalle, y la acción se activa una vez", async () => {
    const alActivar = vi.fn();
    render(
      <Aviso
        variante="error"
        titulo="No se pudo cargar"
        accion={{ etiqueta: "Reintentar", alActivar }}
      >
        Revisá tu conexión.
      </Aviso>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar");
    expect(screen.getByText("Revisá tu conexión.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(alActivar).toHaveBeenCalledTimes(1);
  });
});
