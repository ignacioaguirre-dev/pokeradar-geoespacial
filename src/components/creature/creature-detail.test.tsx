import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatureDetail as Detail } from "@/features/catalog/types";
import { render, screen, waitFor, within } from "@/testing/render";
import { CreatureDetail } from "./creature-detail";

const PIKACHU: Detail = {
  id: 25,
  name: "Pikachu",
  types: ["electric"],
  stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
  heightM: 0.4,
  weightKg: 6,
  sprite: { animated: "https://raw.githubusercontent.com/a/25.gif", still: "https://raw.githubusercontent.com/s/25.png" },
  cry: "https://raw.githubusercontent.com/c/25.ogg",
  flavor: "Cuando se enfada, descarga la energía que almacena.",
};

const noop = () => {};
const played: string[] = [];
const paused: string[] = [];

beforeEach(() => {
  played.length = 0;
  paused.length = 0;
  // jsdom has no media playback: Audio records what it was asked to play
  vi.stubGlobal(
    "Audio",
    class {
      constructor(readonly src: string) {}
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
      pause() {
        paused.push(this.src);
      }
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CreatureDetail", () => {
  it("gives every meter its final value from the first render, even while the bars grow in", () => {
    // A real token: the bars animate, yet the accessible reading must never start at 0
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = real(element, pseudo);
      const read = style.getPropertyValue.bind(style);
      style.getPropertyValue = (name: string) => (name === "--duration-medium" ? "240ms" : read(name));
      return style;
    });
    render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    expect(screen.getByRole("meter", { name: "Velocidad" })).toHaveAttribute("value", "90");
    expect(screen.getByRole("meter", { name: "PS" })).toHaveAttribute("value", "35");
  });

  it("stops the cry when the detail goes away", async () => {
    const { unmount } = render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    await userEvent.click(screen.getByRole("button", { name: "Escuchar grito" }));
    expect(played).toEqual([PIKACHU.cry]);
    unmount();
    expect(paused).toEqual([PIKACHU.cry]);
  });

  it("shows the creature's real data", async () => {
    render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    expect(screen.getByRole("heading", { name: "Pikachu" })).toBeVisible();
    expect(screen.getByText("#025")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Tipos" })).getByText("Eléctrico")).toBeVisible();

    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(6);
    const expected = [
      ["PS", 35],
      ["Ataque", 55],
      ["Defensa", 40],
      ["Ataque especial", 50],
      ["Defensa especial", 50],
      ["Velocidad", 90],
    ] as const;
    for (const [name, value] of expected) {
      const meter = screen.getByRole("meter", { name });
      expect(meter).toHaveAttribute("max", "255");
      await waitFor(() => expect(meter).toHaveAttribute("value", String(value)));
    }

    expect(screen.getByText("0,4 m")).toBeVisible();
    expect(screen.getByText("6,0 kg")).toBeVisible();
    expect(screen.getByText(PIKACHU.flavor!)).toBeVisible();
    expect(screen.getByRole("link", { name: "Datos de PokéAPI" })).toHaveAttribute("href", "https://pokeapi.co");
  });

  it("uses the animated sprite and falls back to the still one under reduced motion", () => {
    const { container } = render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    const img = screen.getByRole("img", { name: "Pikachu" });
    expect(img).toHaveAttribute("src", PIKACHU.sprite.animated);
    expect(img).toHaveAttribute("width", "96");
    expect(img).toHaveAttribute("height", "96");
    const source = container.querySelector("picture source");
    expect(source).toHaveAttribute("media", "(prefers-reduced-motion: reduce)");
    expect(source).toHaveAttribute("srcset", PIKACHU.sprite.still);
  });

  it("uses the still sprite when there is no animated one", () => {
    const data = { ...PIKACHU, sprite: { animated: null, still: PIKACHU.sprite.still } };
    render(<CreatureDetail state="ready" data={data} onRetry={noop} onClose={noop} />);
    expect(screen.getByRole("img", { name: "Pikachu" })).toHaveAttribute("src", PIKACHU.sprite.still);
  });

  it("plays the cry only when asked", async () => {
    render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    expect(played).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Escuchar grito" }));
    expect(played).toEqual([PIKACHU.cry]);
  });

  it("hides the cry button without a cry", () => {
    render(<CreatureDetail state="ready" data={{ ...PIKACHU, cry: null }} onRetry={noop} onClose={noop} />);
    expect(screen.queryByRole("button", { name: "Escuchar grito" })).not.toBeInTheDocument();
  });

  it("hides the cry button when the browser cannot play ogg", () => {
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue("");
    render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={noop} />);
    expect(screen.queryByRole("button", { name: "Escuchar grito" })).not.toBeInTheDocument();
  });

  it("omits the Pokédex text when there is none", () => {
    render(<CreatureDetail state="ready" data={{ ...PIKACHU, flavor: null }} onRetry={noop} onClose={noop} />);
    expect(screen.queryByText(PIKACHU.flavor!)).not.toBeInTheDocument();
  });

  it("closes with the Close button", async () => {
    const onClose = vi.fn();
    render(<CreatureDetail state="ready" data={PIKACHU} onRetry={noop} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("announces the loading state without showing data", () => {
    render(<CreatureDetail state="loading" onRetry={noop} onClose={noop} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando criatura…");
    expect(screen.queryAllByRole("meter")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeVisible();
  });

  it("shows the error with a retry that fetches again", async () => {
    const onRetry = vi.fn();
    render(<CreatureDetail state="error" error="unavailable" onRetry={onRetry} onClose={noop} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar la criatura.");
    expect(alert).toHaveTextContent("Revisá tu conexión y probá de nuevo.");
    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // DESIGN.md: an error says what happened, what to do, and offers the action
  it("says a missing creature does not exist and leads back to the map, with no retry", async () => {
    const onClose = vi.fn();
    render(<CreatureDetail state="error" error="not-found" onRetry={noop} onClose={onClose} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Esta criatura no existe.");
    expect(alert).toHaveTextContent("Revisá el enlace o elegí otra en el mapa.");
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(within(alert).getByRole("button", { name: "Volver al mapa" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
