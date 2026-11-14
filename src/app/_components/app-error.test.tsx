import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/testing/render";
import { AppError } from "./app-error";

// Replaces Next's generic English error page: what happened, what to do, and the action
describe("AppError", () => {
  it("keeps the brand as the page heading", () => {
    render(<AppError onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "PokeRadar Geoespacial" })).toBeInTheDocument();
  });

  it("says what happened and what to do, and retries", async () => {
    const onRetry = vi.fn();
    render(<AppError onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Algo salió mal.");
    expect(alert).toHaveTextContent("Probá de nuevo o volvé al mapa.");
    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("leads back to the map", () => {
    render(<AppError onRetry={vi.fn()} />);
    expect(within(screen.getByRole("alert")).getByRole("link", { name: "Volver al mapa" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
