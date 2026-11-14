import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorContent from "./error-content";

// Rendered without any provider on purpose: when the root layout fails, its translations are gone too
describe("ErrorContent", () => {
  it("shows the app's error in Spanish with its own translations, retries and leads back to the map", async () => {
    const onRetry = vi.fn();
    render(<ErrorContent onRetry={onRetry} />);
    expect(screen.getByRole("heading", { level: 1, name: "PokeRadar Geoespacial" })).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Algo salió mal.");
    expect(alert).toHaveTextContent("Probá de nuevo o volvé al mapa.");
    expect(within(alert).getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/");
    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("ErrorContent's document title", () => {
  it("names the tab only when it replaces the whole document", () => {
    const { unmount } = render(<ErrorContent onRetry={vi.fn()} />);
    expect(document.title).toBe("");
    unmount();
    render(<ErrorContent onRetry={vi.fn()} ownsDocument />);
    expect(document.title).toBe("PokeRadar Geoespacial");
  });
});
