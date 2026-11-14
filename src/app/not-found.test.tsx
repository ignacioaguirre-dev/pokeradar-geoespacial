import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/testing/render";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("says the page does not exist and leads back to the map, without a status code", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "PokeRadar Geoespacial" })).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Esta página no existe.");
    expect(alert).toHaveTextContent("Revisá la dirección o volvé al mapa.");
    expect(within(alert).getByRole("link", { name: "Volver al mapa" })).toHaveAttribute("href", "/");
    expect(document.body).not.toHaveTextContent("404");
  });
});
