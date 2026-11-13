import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pokemon from "@/features/catalog/__fixtures__/pokemon-25.json";
import { render, screen, waitFor } from "@/testing/render";
import { DetailPanel } from "./detail-panel";

const PIKACHU = {
  id: 25,
  name: "Pikachu",
  types: ["electric"],
  stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
  heightM: pokemon.height / 10,
  weightKg: pokemon.weight / 10,
  sprite: { animated: null, still: "https://raw.githubusercontent.com/s/25.png" },
  cry: null,
  flavor: null,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json(PIKACHU))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Mirrors how the route drives the panel: an opener outside it and a map region to fall back to
function Harness({ initial = null as number | null, withOpener = true }) {
  const [id, setId] = useState<number | null>(initial);
  const map = useRef<HTMLElement>(null);
  return (
    <>
      <section ref={map} tabIndex={-1} aria-label="Mapa de Argentina" />
      {withOpener ? <button onClick={() => setId(25)}>Abrir</button> : null}
      <DetailPanel id={id} wide={false} onClose={() => setId(null)} fallbackFocus={() => map.current} />
    </>
  );
}

describe("DetailPanel", () => {
  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("region", { name: /criatura|Pikachu/ })).not.toBeInTheDocument();
  });

  it("opens as a region named after the creature and moves focus to its title", async () => {
    let respond: (response: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => (respond = resolve)));
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("region", { name: "Detalle de criatura" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    respond(Response.json(PIKACHU));
    const region = await screen.findByRole("region", { name: "Pikachu" });
    expect(region).toContainElement(screen.getByRole("heading", { name: "Pikachu" }));
  });

  it("closes with Escape and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(opener);
    await screen.findByRole("region", { name: "Pikachu" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Pikachu" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("closes with the Close button and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(opener);
    await userEvent.click(await screen.findByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Pikachu" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("returns focus to the map when it opened without an origin", async () => {
    render(<Harness initial={25} withOpener={false} />);
    await screen.findByRole("region", { name: "Pikachu" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("region", { name: "Mapa de Argentina" })).toHaveFocus());
  });
});
