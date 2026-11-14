import { fireEvent } from "@testing-library/react";
import { act, type Ref } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/testing/render";
import type { MapStatus } from "@/map/base-map";
import { preloadCreaturePanel } from "./creature-route";
import { MapStage } from "./map-stage";

type Padding = { top: number; right: number; bottom: number; left: number };

const fake = vi.hoisted(() => ({
  mounts: 0,
  active: 0,
  onStatusChange: null as ((status: "ready" | "error") => void) | null,
  padding: null as { top: number; right: number; bottom: number; left: number } | null,
  habitats: null as { features: { properties: { habitat: string } }[] } | null,
  sightings: undefined as readonly (readonly [number, number, number])[] | undefined,
  sweep: undefined as
    | {
        fence: { id: string } | null;
        creatures: readonly { id: number; label: string; sprite: string }[];
        focus: number | null;
        onSelect(id: number): void;
        fencePadding(): Padding;
        detailPadding(): Padding;
      }
    | undefined,
  handle: { zoomIn: () => {}, zoomOut: () => {}, resetView: () => {} },
  webgl2: true,
}));

vi.mock("@/map/base-map", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  function BaseMap({
    habitats,
    sightings,
    sweep,
    padding,
    onStatusChange,
    ref,
  }: {
    habitats: typeof fake.habitats;
    sightings?: typeof fake.sightings;
    sweep?: typeof fake.sweep;
    padding: Padding;
    onStatusChange(status: MapStatus): void;
    ref?: Ref<typeof fake.handle>;
  }) {
    useEffect(() => {
      fake.onStatusChange = onStatusChange;
      fake.padding = padding;
      fake.habitats = habitats;
      fake.sightings = sightings;
      fake.sweep = sweep;
    });
    useEffect(() => {
      fake.mounts += 1;
      fake.active += 1;
      return () => {
        fake.active -= 1;
      };
    }, []);
    useImperativeHandle(ref, () => fake.handle, []);
    return null;
  }
  return { BaseMap };
});

vi.mock("@/map/supports-webgl2", () => ({ supportsWebGL2: () => fake.webgl2 }));
// The detail reads the URL through the Next router, which these tests do not mount
vi.mock("./creature-route", () => ({ CreatureRoute: () => null, preloadCreaturePanel: vi.fn() }));

const WIDE = "(min-width: 768px)";
let wide = false;
const mediaListeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query === WIDE ? wide : false;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
    }) as unknown as MediaQueryList;
}

// next/dynamic resolves the mocked module on microtasks; advancing by 0 flushes them without moving the clock
async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

async function renderStage() {
  render(<MapStage />);
  await flush();
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function report(status: MapStatus) {
  act(() => fake.onStatusChange?.(status));
}

function region() {
  return screen.getByRole("region", { name: "Mapa de Argentina" });
}

// fireEvent instead of userEvent: Testing Library's async wrapper waits on a real setTimeout, which fake timers freeze
function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("MapStage", () => {
  // The first import transforms the habitat GeoJSON on disk, slower than the microtask flush the tests rely on
  beforeAll(async () => {
    await import("./habitat-map");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    fake.mounts = 0;
    fake.active = 0;
    fake.onStatusChange = null;
    fake.padding = null;
    fake.habitats = null;
    fake.sightings = undefined;
    fake.sweep = undefined;
    fake.webgl2 = true;
    fake.handle = { zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn() };
    wide = false;
    mediaListeners.clear();
    installMatchMedia();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows loading and marks the map busy", async () => {
    await renderStage();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando el mapa…");
    expect(region()).toHaveAttribute("aria-busy", "true");
    expect(fake.active).toBe(1);
  });

  it("shows the slow notice after 8 seconds", async () => {
    await renderStage();
    await advance(7_999);
    expect(screen.queryByText("El mapa está tardando más de lo normal.")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByRole("status")).toHaveTextContent("El mapa está tardando más de lo normal.");
    expect(region()).toHaveAttribute("aria-busy", "true");
  });

  it("never shows the slow notice once ready", async () => {
    await renderStage();
    await advance(1_000);
    report("ready");
    await advance(40_000);
    expect(screen.queryByText(/tardando/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(region()).toHaveAttribute("aria-busy", "false");
  });

  it("shows an error with retry when the map fails", async () => {
    await renderStage();
    report("error");
    // BaseMap may report the same failure more than once before load
    report("error");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar el mapa.");
    expect(alert).toHaveTextContent("Revisá tu conexión y probá de nuevo.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("returns to ready when the map recovers after an error", async () => {
    await renderStage();
    report("ready");
    report("error");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    report("ready");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(region()).toHaveAttribute("aria-busy", "false");
  });

  it("times out into the error after 30 seconds", async () => {
    await renderStage();
    await advance(29_999);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el mapa.");
  });

  it("retry remounts the map and goes back to loading", async () => {
    await renderStage();
    report("error");
    click("Reintentar");
    await flush();
    expect(fake.mounts).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando el mapa…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The retry restarts the slow timer from zero
    await advance(7_999);
    expect(screen.queryByText(/tardando/)).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByText("El mapa está tardando más de lo normal.")).toBeInTheDocument();
  });

  it("retry keeps focus on the map region instead of dropping it", async () => {
    await renderStage();
    report("error");
    const retry = screen.getByRole("button", { name: "Reintentar" });
    retry.focus();
    click("Reintentar");
    await flush();
    expect(retry).not.toBeInTheDocument();
    expect(document.activeElement).toBe(region());
  });

  it("a ready report in the same tick as the timeout wins", async () => {
    await renderStage();
    await advance(29_999);
    // The timer fires before React re-renders and clears it
    act(() => {
      fake.onStatusChange?.("ready");
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(region()).toHaveAttribute("aria-busy", "false");
  });

  it("inserts the error as a new alert instead of mutating the loading status", async () => {
    await renderStage();
    const status = screen.getByRole("status");
    report("error");
    expect(status).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el mapa.");
  });

  it("retry twice mounts a single map", async () => {
    await renderStage();
    report("error");
    click("Reintentar");
    await flush();
    report("error");
    click("Reintentar");
    await flush();
    expect(fake.mounts).toBe(3);
    expect(fake.active).toBe(1);
  });

  it("shows the offline error when the browser is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await renderStage();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sin conexión.");
    expect(alert).toHaveTextContent("El mapa necesita internet para cargarse.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("shows the offline error when the map fails while offline", async () => {
    await renderStage();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    report("error");
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión.");
  });

  it("shows the unsupported notice and never mounts the map", async () => {
    fake.webgl2 = false;
    await renderStage();
    await advance(40_000);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Este navegador no puede mostrar el mapa.");
    expect(status).toHaveTextContent("Probá actualizarlo o activar la aceleración por hardware.");
    expect(fake.mounts).toBe(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The controls could never enable without a map
    expect(screen.queryByRole("navigation", { name: "Controles del mapa" })).not.toBeInTheDocument();
  });

  it("zoom controls are disabled until ready", async () => {
    await renderStage();
    const controls = screen.getByRole("navigation", { name: "Controles del mapa" });
    const zoomIn = screen.getByRole("button", { name: "Acercar" });
    const zoomOut = screen.getByRole("button", { name: "Alejar" });
    const reset = screen.getByRole("button", { name: "Ver Argentina" });
    for (const button of [zoomIn, zoomOut, reset]) {
      expect(controls).toContainElement(button);
      expect(button).toBeDisabled();
    }
    report("ready");
    for (const button of [zoomIn, zoomOut, reset]) expect(button).toBeEnabled();
    click("Acercar");
    click("Alejar");
    click("Ver Argentina");
    expect(fake.handle.zoomIn).toHaveBeenCalledOnce();
    expect(fake.handle.zoomOut).toHaveBeenCalledOnce();
    expect(fake.handle.resetView).toHaveBeenCalledOnce();
  });

  it("hands the generated habitats to the map", async () => {
    await renderStage();
    expect(fake.habitats?.features.map((f) => f.properties.habitat).sort()).toEqual(
      ["forest", "grassland", "mountain", "rough-terrain", "sea", "waters-edge"],
    );
  });

  it("hands the sightings to the map once they resolve", async () => {
    render(<MapStage sightings={Promise.resolve({ sightings: [[25, -58.4, -34.6] as const], slugs: [] })} />);
    await flush();
    expect(fake.sightings).toEqual([[25, -58.4, -34.6]]);
  });

  // Pending sightings (catalog slow or down) must not hold the map back
  it("mounts the map while the sightings are still pending", async () => {
    render(<MapStage sightings={new Promise(() => {})} />);
    await flush();
    expect(fake.mounts).toBe(1);
    expect(fake.sightings).toBeUndefined();
    report("ready");
    expect(region()).toHaveAttribute("aria-busy", "false");
  });

  it("the habitat legend waits for the map", async () => {
    await renderStage();
    const legend = screen.getByRole("button", { name: "Hábitats" });
    expect(legend).toBeDisabled();
    report("ready");
    expect(legend).toBeEnabled();
  });

  it("updates the map padding when the viewport widens", async () => {
    await renderStage();
    expect(fake.padding).toEqual({ top: 64, right: 12, bottom: 284, left: 12 });
    wide = true;
    act(() => mediaListeners.forEach((listener) => listener()));
    expect(fake.padding).toEqual({ top: 96, right: 120, bottom: 72, left: 352 });
    expect(fake.mounts).toBe(1);
  });

  describe("sweep", () => {
    // Two creatures inside Esteros del Iberá, one far away in Patagonia
    const PAYLOAD = {
      sightings: [
        [25, -57.4, -28.8],
        [7, -57.1, -29.2],
        [41, -69, -46.5],
      ] as const,
      slugs: Object.assign(Array<string>(386).fill("x"), { 24: "pikachu", 6: "squirtle", 40: "zubat" }),
    };

    afterEach(() => window.history.replaceState(null, "", "/"));

    it("lists the eight fences, none chosen, and says what to do", async () => {
      await renderStage();
      const group = screen.getByRole("group", { name: "Cercas" });
      expect(within(group).getAllByRole("button", { pressed: false })).toHaveLength(8);
      expect(screen.getByText("Elegí una cerca para barrerla.")).toBeInTheDocument();
      expect(fake.sweep?.fence).toBeNull();
    });

    it("choosing a fence sweeps it: the map gets the fence and its creatures, the reading the count", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Esteros del Iberá");
      expect(screen.getByRole("button", { name: "Esteros del Iberá", pressed: true })).toBeInTheDocument();
      expect(fake.sweep?.fence?.id).toBe("ibera");
      expect(fake.sweep?.creatures.map((c) => [c.id, c.label])).toEqual([
        [25, "Ver Pikachu"],
        [7, "Ver Squirtle"],
      ]);
      expect(fake.sweep?.creatures[0].sprite).toMatch(/\/25\.png$/);
      expect(screen.getByText(/criaturas detectadas/).closest("[role=status]")).toHaveTextContent(
        "2 criaturas detectadas",
      );
    });

    it("a creature from the list or a marker opens its detail in the URL", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Esteros del Iberá");
      click("Ver Squirtle");
      expect(window.location.search).toBe("?creature=7");
      act(() => fake.sweep?.onSelect(25));
      expect(window.location.search).toBe("?creature=25");
    });

    it("frames the fence above the reading on phones and beside the panel on desktop", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Esteros del Iberá");
      expect(fake.sweep?.fencePadding()).toEqual({ top: 64, right: 12, bottom: 336, left: 12 });
      wide = true;
      act(() => mediaListeners.forEach((listener) => listener()));
      expect(fake.sweep?.fencePadding()).toEqual({ top: 96, right: 120, bottom: 72, left: 352 });
    });

    // At 768–1100 px both side panels would leave the fence a sliver: the creature gets the room instead
    it("with the detail open on a narrow desktop, the sweep panel side gives way", async () => {
      wide = true;
      window.innerWidth = 900;
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      const padding = fake.sweep!.detailPadding();
      expect(900 - padding.left - padding.right).toBeGreaterThanOrEqual(320);
      window.innerWidth = 1280;
      expect(fake.sweep!.detailPadding()).toEqual({ top: 96, right: 396, bottom: 72, left: 352 });
    });

    it("an empty fence says so", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Mar Argentino");
      expect(screen.getByText(/no hay criaturas en esta cerca. Probá con otra./)).toBeInTheDocument();
      expect(fake.sweep?.creatures).toEqual([]);
    });

    it("when the creatures could not load, the sweep says so with a retry", async () => {
      render(<MapStage sightings={Promise.resolve(null)} />);
      await flush();
      click("Pampa húmeda");
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("No pudimos cargar las criaturas.");
      expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    });

    // Touch screens never hover: the detail's code comes once the map is up and the browser idle
    it("loads the detail panel's code once the map is ready", async () => {
      vi.mocked(preloadCreaturePanel).mockClear();
      await renderStage();
      await advance(10);
      expect(preloadCreaturePanel).not.toHaveBeenCalled();
      report("ready");
      await advance(10);
      expect(preloadCreaturePanel).toHaveBeenCalledOnce();
    });

    // Without WebGL there is no map, but the list still reaches every creature
    it("works without the map: the picker and the list stay", async () => {
      fake.webgl2 = false;
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Esteros del Iberá");
      expect(screen.getByRole("button", { name: "Ver Pikachu" })).toBeInTheDocument();
    });
  });
});
