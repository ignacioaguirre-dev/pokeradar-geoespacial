import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import { Notice } from "./notice";

describe("Notice", () => {
  it("info and success are status", () => {
    const { rerender } = render(<Notice variant="info" title="Cargado" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargado");
    rerender(<Notice variant="success" title="Listo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Listo");
  });

  it("error is an alert, shows title and detail, and the action fires once", async () => {
    const onActivate = vi.fn();
    render(
      <Notice variant="error" title="No se pudo cargar" action={{ label: "Reintentar", onActivate }}>
        Revisá tu conexión.
      </Notice>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar");
    expect(screen.getByText("Revisá tu conexión.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
