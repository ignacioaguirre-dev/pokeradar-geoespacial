import { fireEvent } from "@testing-library/react";
import { act, type Ref } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/testing/render";
import type { MapInput, MapStatus } from "@/map/base-map";
import { createMapHelpStore, MAP_HELP_SEEN_KEY, type MapHelpStore } from "@/features/map-help/storage";
import { preloadCreaturePanel } from "./creature-route";
import { introPlayed } from "./intro-played";
import { MapStage } from "./map-stage";

type Padding = { top: number; right: number; bottom: number; left: number };

const fake = vi.hoisted(() => ({
  mounts: 0,
  active: 0,
  onStatusChange: null as ((status: "ready" | "error") => void) | null,
  onInputDetected: null as ((input: MapInput) => void) | null,
  onInteract: null as (() => void) | null,
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
  draft: undefined as { ring: readonly (readonly [number, number])[]; onPoint(point: readonly [number, number]): void } | null | undefined,
  keyboardHelp: undefined as string | undefined,
  intro: undefined as boolean | undefined,
  // The latest intro prop, while `intro` keeps the one the map was created with
  introNow: undefined as boolean | undefined,
  onIntroEnd: undefined as (() => void) | undefined,
  handle: {
    zoomIn: () => {},
    zoomOut: () => {},
    resetView: () => {},
    skipIntro: () => {},
    focus: () => {},
    reticlePoint: (): readonly [number, number] | null => null,
  },
  webgl2: true,
  chunkFailures: 0,
  // While pending, the map suspends as if its chunk were still downloading
  chunk: null as Promise<void> | null,
}));

vi.mock("@/map/base-map", async () => {
  const { use, useEffect, useImperativeHandle, useState } = await import("react");
  function BaseMap({
    habitats,
    sightings,
    sweep,
    draft,
    labels,
    padding,
    intro,
    onIntroEnd,
    onStatusChange,
    onInputDetected,
    onInteract,
    ref,
  }: {
    habitats: typeof fake.habitats;
    sightings?: typeof fake.sightings;
    sweep?: typeof fake.sweep;
    draft?: typeof fake.draft;
    labels: { keyboardHelp: string };
    padding: Padding;
    intro?: boolean;
    onIntroEnd?(): void;
    onStatusChange(status: MapStatus): void;
    onInputDetected?(input: MapInput): void;
    onInteract?(): void;
    ref?: Ref<typeof fake.handle>;
  }) {
    if (fake.chunk) use(fake.chunk);
    useEffect(() => {
      fake.onStatusChange = onStatusChange;
      fake.onInputDetected = onInputDetected ?? null;
      fake.onInteract = onInteract ?? null;
      fake.padding = padding;
      fake.habitats = habitats;
      fake.sightings = sightings;
      fake.sweep = sweep;
      fake.draft = draft;
      fake.keyboardHelp = labels.keyboardHelp;
      fake.onIntroEnd = onIntroEnd;
      fake.introNow = intro;
    });
    // BaseMap reads intro only when it creates the map
    const [firstIntro] = useState(intro);
    useEffect(() => {
      fake.intro = firstIntro;
    }, [firstIntro]);
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

// Reading the export stands in for a download of the map's chunk; a throw is a failed one
vi.mock("./habitat-map", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./habitat-map")>();
  return {
    get HabitatMap() {
      if (fake.chunkFailures > 0) {
        fake.chunkFailures -= 1;
        throw new Error("ChunkLoadError");
      }
      return actual.HabitatMap;
    },
  };
});

// The real store caches per module; each test gets a fresh one so a dismissal does not leak into the next
const helpStore = vi.hoisted(() => ({ current: null as MapHelpStore | null }));
vi.mock("@/features/map-help/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/map-help/storage")>();
  const store = () => helpStore.current ?? actual.createMapHelpStore();
  return {
    ...actual,
    subscribe: (onChange: () => void) => store().subscribe(onChange),
    getSnapshot: () => store().getSnapshot(),
    markMapHelpSeen: () => store().markSeen(),
  };
});

vi.mock("@/map/supports-webgl2", () => ({ supportsWebGL2: () => fake.webgl2 }));
// The detail reads the URL through the Next router, which these tests do not mount
const route = vi.hoisted(() => ({ onChange: null as ((id: number | null) => void) | null }));
vi.mock("./creature-route", () => ({
  CreatureRoute: ({ onChange }: { onChange?(id: number | null): void }) => {
    route.onChange = onChange ?? null;
    return null;
  },
  preloadCreaturePanel: vi.fn(),
}));

const WIDE = "(min-width: 768px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
let wide = false;
// Media queries that match besides WIDE and REDUCED (pointer and hover)
let matching = new Set<string>();
let reduced = true;
const mediaListeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query === WIDE ? wide : query === REDUCED ? reduced : matching.has(query);
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
  // The first import transforms the habitat GeoJSON on disk (and the controls' chunks, the sheet's motion), slower
  // than the microtask flush the tests rely on
  beforeAll(async () => {
    await Promise.all([
      import("./habitat-map"),
      import("./fence-drawing"),
      import("./control-column"),
      import("./control-row"),
      import("@/components/ui/sheet"),
    ]);
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
    fake.chunkFailures = 0;
    fake.chunk = null;
    fake.intro = undefined;
    fake.introNow = undefined;
    introPlayed.current = false;
    fake.onIntroEnd = undefined;
    fake.handle = {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetView: vi.fn(),
      skipIntro: vi.fn(),
      focus: vi.fn(),
      reticlePoint: () => null,
    };
    fake.draft = undefined;
    wide = false;
    matching = new Set(["(pointer: fine) and (hover: hover)"]);
    localStorage.clear();
    helpStore.current = createMapHelpStore();
    // Most states are about loading, not the flight
    reduced = true;
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
    expect(alert).toHaveTextContent("No se pudo cargar el mapa.");
    expect(alert).toHaveTextContent("El mapa necesita internet para cargarse.");
    // The global connection notice is the only one that says "Sin conexión."
    expect(alert).not.toHaveTextContent("Sin conexión.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("shows the offline error when the map fails while offline", async () => {
    await renderStage();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    report("error");
    expect(screen.getByRole("alert")).toHaveTextContent("El mapa necesita internet para cargarse.");
  });

  it("remounts the map on its own when the connection comes back while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await renderStage();
    report("error");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el mapa.");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(fake.mounts).toBe(2);
    expect(fake.active).toBe(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando el mapa…");
  });

  it("remounts a failed map when the connection comes back, without moving focus", async () => {
    await renderStage();
    report("error");
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(fake.mounts).toBe(2);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("keeps focus on the map region when the focused retry goes away with the reconnection", async () => {
    await renderStage();
    report("error");
    screen.getByRole("button", { name: "Reintentar" }).focus();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(document.activeElement).toBe(region());
  });

  it("leaves a working map alone when the connection comes back", async () => {
    await renderStage();
    report("ready");
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(fake.mounts).toBe(1);
  });

  it("a map chunk that cannot download shows the error with retry, and retry asks for it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.chunkFailures = 1;
    await renderStage();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar el mapa.");
    click("Reintentar");
    await flush();
    expect(fake.mounts).toBe(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    expect(fake.padding).toEqual({ top: 64, right: 68, bottom: 160, left: 12 });
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
      expect(fake.sweep?.fencePadding()).toEqual({ top: 64, right: 68, bottom: 212, left: 12 });
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

    // The sheet rises from the bottom edge and stops 160 px from the top: the creature lands above it
    it("on phones the detail leaves the creature above the sheet", async () => {
      window.innerHeight = 844;
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      expect(fake.sweep!.detailPadding()).toEqual({ top: 64, right: 68, bottom: 506, left: 12 });
      window.innerHeight = 500;
      expect(fake.sweep!.detailPadding()).toEqual({ top: 64, right: 68, bottom: 300, left: 12 });
      window.innerHeight = 768;
    });

    // The panel grows with the reading (three lines on a phone): a fixed guess would leave creatures under it
    it("on phones frames the fence above the sweep panel as tall as it really is", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Esteros del Iberá");
      const panel = screen.getByRole("group", { name: "Cercas" }).parentElement!;
      vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ top: 418, height: 410 } as DOMRect);
      window.innerHeight = 844;
      expect(fake.sweep?.fencePadding().bottom).toBe(844 - 418 + 12);
    });

    it("an empty fence says so", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      click("Mar Argentino");
      expect(screen.getByText("Mar Argentino: ninguna criatura detectada. Probá con otra cerca.")).toBeInTheDocument();
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

    // Rings with nothing to trace would play once empty and again when the creatures arrive
    it("the sweep waits for the sightings before it plays", async () => {
      let resolve: (payload: typeof PAYLOAD) => void = () => {};
      render(<MapStage sightings={new Promise((r) => (resolve = r))} />);
      await flush();
      click("Esteros del Iberá");
      expect(screen.getByText("Buscando criaturas…")).toBeInTheDocument();
      expect(fake.sweep?.fence).toBeNull();
      await act(async () => resolve(PAYLOAD));
      await flush();
      expect(fake.sweep?.fence?.id).toBe("ibera");
      expect(fake.sweep?.creatures).toHaveLength(2);
    });

    it("without sightings the sweep never plays", async () => {
      render(<MapStage sightings={Promise.resolve(null)} />);
      await flush();
      click("Pampa húmeda");
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(fake.sweep?.fence).toBeNull();
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

    // Only the flight holds them back: a fence chosen while the map loads plays once the map is ready
    it("without a flight the fences work while the map still loads", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      expect(region()).toHaveAttribute("aria-busy", "true");
      click("Esteros del Iberá");
      expect(fake.sweep?.fence?.id).toBe("ibera");
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

  describe("movement help", () => {
    const TOUCH = "Arrastrá con un dedo para moverte · Pellizcá para acercar o alejar";
    const TOUCHPAD = "Touchpad: dos dedos para moverte · pellizcá para acercar";
    const MOUSE = "Mouse: arrastrá para moverte · rueda para acercar";
    const KEYBOARD = "Teclado: flechas para moverte · + y − para acercar";
    const SEEN_KEY = MAP_HELP_SEEN_KEY;

    // The intro is the status that carries the help lines
    function intro() {
      return screen.queryAllByRole("status").find((status) => /para moverte/.test(status.textContent ?? "")) ?? null;
    }

    async function readyStage() {
      await renderStage();
      report("ready");
    }

    it("waits for the map before showing", async () => {
      await renderStage();
      expect(intro()).toBeNull();
      report("ready");
      expect(intro()).not.toBeNull();
    });

    // On desktop the intro sits beside the sweep panel, where the creatures of a fence land
    it("closes when a fence is chosen, like any first interaction", async () => {
      await readyStage();
      click("Esteros del Iberá");
      expect(intro()).toBeNull();
      expect(localStorage.getItem(SEEN_KEY)).not.toBeNull();
    });

    // Fences, then what they found, then the help and the map controls: the order on screen on a phone
    it("comes after the fences in the keyboard order", async () => {
      await readyStage();
      const lastFence = screen.getByRole("button", { name: "Selva misionera" });
      const dismiss = screen.getByRole("button", { name: "Entendido" });
      expect(lastFence.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows touchpad, mouse and keyboard on a computer", async () => {
      await readyStage();
      const items = within(intro() as HTMLElement).getAllByRole("listitem").map((item) => item.textContent);
      expect(items).toEqual([TOUCHPAD, MOUSE, KEYBOARD]);
    });

    it("shows touch on a phone", async () => {
      matching = new Set(["(pointer: coarse)", "(any-pointer: coarse)"]);
      await readyStage();
      const items = within(intro() as HTMLElement).getAllByRole("listitem").map((item) => item.textContent);
      expect(items).toEqual([TOUCH]);
    });

    it("shows both on a laptop with a touch screen", async () => {
      matching = new Set(["(pointer: fine) and (hover: hover)", "(any-pointer: coarse)"]);
      await readyStage();
      const items = within(intro() as HTMLElement).getAllByRole("listitem").map((item) => item.textContent);
      expect(items).toEqual([TOUCHPAD, MOUSE, KEYBOARD, TOUCH]);
    });

    it("closes with Entendido, remembers it and leaves the focus on the help button", async () => {
      await readyStage();
      click("Entendido");
      expect(intro()).toBeNull();
      expect(localStorage.getItem(SEEN_KEY)).toBe("1");
      expect(screen.getByRole("button", { name: "Cómo moverse" })).toHaveFocus();
    });

    it("closes with the first move of the map", async () => {
      await readyStage();
      act(() => fake.onInteract?.());
      expect(intro()).toBeNull();
      expect(localStorage.getItem(SEEN_KEY)).toBe("1");
    });

    it("closes when a control is used", async () => {
      await readyStage();
      click("Acercar");
      expect(intro()).toBeNull();
      expect(fake.handle.zoomIn).toHaveBeenCalledOnce();
    });

    it("does not come back once seen", async () => {
      localStorage.setItem(SEEN_KEY, "1");
      await readyStage();
      expect(intro()).toBeNull();
    });

    it("still works without storage", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      await readyStage();
      expect(intro()).not.toBeNull();
      click("Entendido");
      expect(intro()).toBeNull();
    });

    it("never shows when the map cannot load", async () => {
      fake.webgl2 = false;
      await renderStage();
      expect(intro()).toBeNull();
      expect(screen.queryByRole("button", { name: "Cómo moverse" })).not.toBeInTheDocument();
    });

    // On desktop it rides in the legend's row, apart from the controls that move the map
    it("the help button sits right after the legend and waits for the map", async () => {
      wide = true;
      await renderStage();
      const button = screen.getByRole("button", { name: "Cómo moverse" });
      const legend = screen.getByRole("button", { name: "Hábitats" });
      expect(legend.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole("navigation", { name: "Controles del mapa" })).not.toContainElement(button);
      expect(button).toBeDisabled();
      report("ready");
      expect(button).toBeEnabled();
    });

    it("closes the open help panel with the first move of the map, like the intro", async () => {
      wide = true;
      localStorage.setItem(SEEN_KEY, "1");
      await readyStage();
      click("Cómo moverse");
      expect(screen.getByRole("region", { name: "Cómo moverse" })).toBeInTheDocument();
      act(() => fake.onInteract?.());
      expect(screen.queryByRole("region", { name: "Cómo moverse" })).not.toBeInTheDocument();
    });

    // On a phone the detail is a bottom sheet over the controls row; the help would peek out above it
    it("steps aside while the creature detail covers the controls on a phone", async () => {
      await readyStage();
      act(() => route.onChange?.(25));
      expect(intro()).toBeNull();
      act(() => route.onChange?.(null));
      expect(intro()).not.toBeNull();
      expect(localStorage.getItem(SEEN_KEY)).toBeNull();
    });

    it("closes the help sheet when the creature detail opens on a phone", async () => {
      localStorage.setItem(SEEN_KEY, "1");
      await readyStage();
      click("Cómo moverse");
      await flush();
      expect(screen.getByRole("dialog", { name: "Cómo moverse" })).toBeInTheDocument();
      act(() => route.onChange?.(25));
      await advance(1_000);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // On desktop the detail floats at the top right and the help stays at the bottom left
    it("stays beside the creature detail on a roomy desktop", async () => {
      wide = true;
      matching.add("(min-width: 1120px)");
      await readyStage();
      act(() => route.onChange?.(25));
      expect(intro()).not.toBeNull();
    });

    // Between 768 and 1120 px the help beside the sweep panel would run under the detail
    it("waits on a narrow desktop while the creature detail is open, and closes its open panel", async () => {
      wide = true;
      await readyStage();
      act(() => route.onChange?.(25));
      expect(intro()).toBeNull();
      act(() => route.onChange?.(null));
      expect(intro()).not.toBeNull();
      click("Entendido");
      click("Cómo moverse");
      act(() => route.onChange?.(25));
      expect(screen.queryByRole("region", { name: "Cómo moverse" })).not.toBeInTheDocument();
    });

    it.each([
      { device: "phone", role: "dialog" },
      { device: "desktop", role: "region" },
    ] as const)("reopens the help with the detected input first on a $device", async ({ device, role }) => {
      wide = device === "desktop";
      await readyStage();
      act(() => fake.onInputDetected?.("mouse"));
      click("Cómo moverse");
      await flush();
      expect(intro()).toBeNull();
      const panel = screen.getByRole(role, { name: "Cómo moverse" });
      expect(within(panel).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        MOUSE,
        TOUCHPAD,
        KEYBOARD,
        TOUCH,
      ]);
    });
  });


  describe("control column on a phone", () => {
    const COLUMN = ["Acercar", "Alejar", "Cómo moverse", "Ver Argentina", "Hábitats"];

    async function readyStage() {
      localStorage.setItem(MAP_HELP_SEEN_KEY, "1");
      await renderStage();
      report("ready");
    }

    function column() {
      return screen.getByRole("navigation", { name: "Controles del mapa" });
    }

    it("stacks zoom, help, the country and the habitats, all waiting for the map", async () => {
      await renderStage();
      const buttons = within(column()).getAllByRole("button");
      expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(COLUMN);
      for (const button of buttons) expect(button).toBeDisabled();
      report("ready");
      for (const button of within(column()).getAllByRole("button")) expect(button).toBeEnabled();
    });

    it("zoom and the country act on the map at once", async () => {
      await readyStage();
      click("Acercar");
      click("Alejar");
      click("Ver Argentina");
      expect(fake.handle.zoomIn).toHaveBeenCalledOnce();
      expect(fake.handle.zoomOut).toHaveBeenCalledOnce();
      expect(fake.handle.resetView).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("Hábitats opens a sheet with the legend, and closing it gives the focus back", async () => {
      await readyStage();
      const layers = screen.getByRole("button", { name: "Hábitats" });
      fireEvent.click(layers);
      await flush();
      const sheet = screen.getByRole("dialog", { name: "Hábitats" });
      expect(layers).toHaveAttribute("aria-expanded", "true");
      expect(within(sheet).getAllByRole("listitem")).toHaveLength(6);
      fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar" }));
      await advance(1_000);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(layers).toHaveFocus();
    });

    it("the first visit's help sits beside the info mark, inside the column", async () => {
      localStorage.clear();
      await renderStage();
      report("ready");
      expect(within(column()).getByRole("status")).toHaveTextContent("Cómo moverse");
    });

    it("steps aside while the creature detail is open, and comes back after", async () => {
      await readyStage();
      act(() => route.onChange?.(25));
      expect(screen.queryByRole("navigation", { name: "Controles del mapa" })).not.toBeInTheDocument();
      act(() => route.onChange?.(null));
      expect(column()).toBeInTheDocument();
    });

    it("a viewport that widens drops the open sheet for the desktop row", async () => {
      await readyStage();
      click("Hábitats");
      await flush();
      expect(screen.getByRole("dialog", { name: "Hábitats" })).toBeInTheDocument();
      wide = true;
      act(() => mediaListeners.forEach((listener) => listener()));
      await advance(1_000);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver Argentina" })).toHaveTextContent("Ver Argentina");
    });
  });

  describe("entry flight", () => {
    const SKIP = "Saltar el vuelo de entrada";

    function endFlight() {
      act(() => fake.onIntroEnd?.());
    }

    beforeEach(() => {
      reduced = false;
    });

    it("flies in on the first load and offers to skip it", async () => {
      await renderStage();
      expect(fake.intro).toBe(true);
      const skip = screen.getByRole("button", { name: SKIP });
      expect(skip).toHaveTextContent("Saltar");
    });

    it("keeps the fences disabled while flying, like the map controls", async () => {
      await renderStage();
      report("ready");
      const fences = within(screen.getByRole("group", { name: "Cercas" })).getAllByRole("button");
      // The eight presets and Trazar cerca
      expect(fences).toHaveLength(9);
      for (const fence of fences) expect(fence).toBeDisabled();
      endFlight();
      for (const fence of fences) expect(fence).toBeEnabled();
    });

    it("a skipped flight hands the fences over at once", async () => {
      fake.handle.skipIntro = vi.fn(() => fake.onIntroEnd?.());
      await renderStage();
      report("ready");
      act(() => click(SKIP));
      expect(screen.getByRole("button", { name: "Esteros del Iberá" })).toBeEnabled();
    });

    it("keeps the controls disabled while flying, even once ready", async () => {
      await renderStage();
      report("ready");
      expect(region()).toHaveAttribute("aria-busy", "false");
      for (const name of ["Acercar", "Alejar", "Ver Argentina", "Hábitats"]) {
        expect(screen.getByRole("button", { name })).toBeDisabled();
      }
      endFlight();
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      for (const name of ["Acercar", "Alejar", "Ver Argentina", "Hábitats"]) {
        expect(screen.getByRole("button", { name })).toBeEnabled();
      }
    });

    it("skip ends the flight and hands focus to the map", async () => {
      fake.handle.skipIntro = vi.fn(() => fake.onIntroEnd?.());
      await renderStage();
      report("ready");
      act(() => click(SKIP));
      expect(fake.handle.skipIntro).toHaveBeenCalledOnce();
      expect(fake.handle.focus).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    it("skip before the map mounts creates it without a flight", async () => {
      let arrive = () => {};
      fake.chunk = new Promise((resolve) => {
        arrive = resolve;
      });
      await renderStage();
      expect(fake.active).toBe(0);
      await act(async () => click(SKIP));
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      expect(region()).toHaveFocus();
      fake.chunk = null;
      arrive();
      await flush();
      expect(fake.active).toBe(1);
      expect(fake.intro).toBe(false);
      report("ready");
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    it("flies once per page load, even if the stage remounts", async () => {
      const { unmount } = render(<MapStage />);
      await flush();
      report("ready");
      endFlight();
      unmount();
      await renderStage();
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
    });

    it("moves focus from skip to the map when the flight ends by itself", async () => {
      await renderStage();
      report("ready");
      act(() => screen.getByRole("button", { name: SKIP }).focus());
      endFlight();
      expect(fake.handle.focus).toHaveBeenCalledOnce();
    });

    it("leaves focus alone when the flight ends elsewhere", async () => {
      await renderStage();
      report("ready");
      endFlight();
      expect(fake.handle.focus).not.toHaveBeenCalled();
    });

    it("tells the map the flight is over, so it drops the space background", async () => {
      await renderStage();
      expect(fake.introNow).toBe(true);
      report("ready");
      endFlight();
      expect(fake.introNow).toBe(false);
    });

    it("does not fly under a creature opened from a shared link", async () => {
      window.history.replaceState(null, "", "/?creature=25");
      try {
        await renderStage();
      } finally {
        window.history.replaceState(null, "", "/");
      }
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
    });

    it("still flies when the creature in the link is not a valid id", async () => {
      window.history.replaceState(null, "", "/?creature=pikachu");
      try {
        await renderStage();
      } finally {
        window.history.replaceState(null, "", "/");
      }
      expect(fake.intro).toBe(true);
    });

    it("does not fly with reduced motion", async () => {
      reduced = true;
      await renderStage();
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      report("ready");
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    it("hides skip on error and does not fly again after retry", async () => {
      await renderStage();
      report("error");
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      click("Reintentar");
      await flush();
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      report("ready");
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    it("does not fly again when the connection comes back after the flight and remounts a failed map", async () => {
      await renderStage();
      report("ready");
      endFlight();
      report("error");
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await flush();
      expect(fake.mounts).toBe(2);
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      report("ready");
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    it("does not resume the flight when the connection comes back mid-flight and remounts a failed map", async () => {
      await renderStage();
      report("error");
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await flush();
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
    });

    it("a map chunk that fails during the flight leaves only the error, and retry lands without flying", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fake.chunkFailures = 1;
      await renderStage();
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el mapa.");
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      expect(fake.active).toBe(0);
      click("Reintentar");
      await flush();
      expect(fake.active).toBe(1);
      expect(fake.intro).toBe(false);
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      report("ready");
      expect(screen.getByRole("button", { name: "Acercar" })).toBeEnabled();
    });

    // It explains how to move a map that cannot move yet, and would sit under the skip button's focus
    it("holds the movement help until the flight ends", async () => {
      await renderStage();
      report("ready");
      expect(screen.queryByRole("button", { name: "Entendido" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cómo moverse" })).toBeDisabled();
      endFlight();
      expect(screen.getByRole("button", { name: "Entendido" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cómo moverse" })).toBeEnabled();
      expect(localStorage.getItem(MAP_HELP_SEEN_KEY)).toBeNull();
    });

    it("shows the movement help once the flight is skipped, without taking the focus from the map", async () => {
      fake.handle.skipIntro = vi.fn(() => fake.onIntroEnd?.());
      await renderStage();
      report("ready");
      act(() => click(SKIP));
      expect(screen.queryByRole("button", { name: SKIP })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Entendido" })).toBeInTheDocument();
      expect(fake.handle.focus).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Entendido" })).not.toHaveFocus();
    });
  });

  describe("drawing a fence", () => {
    // A box in Corrientes, around two creatures
    const PAYLOAD = {
      sightings: [
        [25, -58.0, -28.5],
        [7, -57.8, -28.7],
      ] as const,
      slugs: Object.assign(Array<string>(386).fill("x"), { 24: "pikachu", 6: "squirtle" }),
    };
    const IBERA_BOX = [
      [-58.5, -29],
      [-57.5, -29],
      [-57.5, -28],
      [-58.5, -28],
    ] as const;
    const TRACE = "Trazar cerca";

    async function startDrawing() {
      click(TRACE);
      await flush();
    }

    function place(...points: (readonly [number, number])[]) {
      for (const point of points) act(() => fake.draft?.onPoint(point));
    }

    it("waits for the settled map", async () => {
      await renderStage();
      expect(screen.getByRole("button", { name: TRACE })).toBeDisabled();
      report("ready");
      expect(screen.getByRole("button", { name: TRACE })).toBeEnabled();
    });

    it("entering the mode swaps the fences for its panel, clears the sweep and focuses «Sumar punto acá»", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      report("ready");
      click("Esteros del Iberá");
      expect(fake.sweep?.fence?.id).toBe("ibera");
      await startDrawing();
      expect(screen.getByRole("region", { name: "Trazando cerca" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Cercas" })).not.toBeInTheDocument();
      expect(fake.sweep?.fence).toBeNull();
      expect(fake.draft?.ring).toEqual([]);
      expect(fake.keyboardHelp).toMatch(/Enter para sumar ese punto/);
      expect(screen.getByRole("button", { name: "Sumar punto acá" })).toHaveFocus();
    });

    it("points from the map become vertices on the map", async () => {
      await renderStage();
      report("ready");
      await startDrawing();
      place(IBERA_BOX[0], IBERA_BOX[1]);
      expect(fake.draft?.ring).toEqual([IBERA_BOX[0], IBERA_BOX[1]]);
      expect(screen.getByText("2 de 12 vértices")).toBeInTheDocument();
    });

    it("«Sumar punto acá» adds the map's reticle point", async () => {
      fake.handle.reticlePoint = () => IBERA_BOX[0];
      await renderStage();
      report("ready");
      await startDrawing();
      click("Sumar punto acá");
      expect(fake.draft?.ring).toEqual([IBERA_BOX[0]]);
    });

    it("closing sweeps the drawn fence as the active one and gives the focus back to «Trazar cerca»", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      report("ready");
      await startDrawing();
      place(...IBERA_BOX);
      click("Cerrar cerca");
      expect(fake.draft).toBeNull();
      expect(fake.sweep?.fence).toMatchObject({ id: "own", ring: IBERA_BOX });
      expect(fake.sweep?.creatures.map((c) => c.id)).toEqual([25, 7]);
      expect(screen.getByRole("status")).toHaveTextContent("Tu cerca: 2 criaturas detectadas");
      expect(screen.getByRole("button", { name: TRACE })).toHaveFocus();
      // No preset is the active one
      expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
    });

    it("a preset chosen afterwards replaces the drawn fence", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      report("ready");
      await startDrawing();
      place(...IBERA_BOX);
      click("Cerrar cerca");
      click("Pampa húmeda");
      expect(fake.sweep?.fence?.id).toBe("pampa");
    });

    it("cancelling, with the button or Escape, brings the last fence back and the focus to «Trazar cerca»", async () => {
      render(<MapStage sightings={Promise.resolve(PAYLOAD)} />);
      await flush();
      report("ready");
      click("Esteros del Iberá");
      await startDrawing();
      place(IBERA_BOX[0]);
      click("Cancelar");
      expect(fake.draft).toBeNull();
      expect(fake.sweep?.fence?.id).toBe("ibera");
      expect(screen.getByRole("button", { name: TRACE })).toHaveFocus();
      await startDrawing();
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      expect(fake.draft).toBeNull();
      expect(screen.getByRole("button", { name: TRACE })).toHaveFocus();
    });

    it("on phones the control column keeps moving the map while drawing", async () => {
      await renderStage();
      report("ready");
      await startDrawing();
      const column = screen.getByRole("navigation", { name: "Controles del mapa" });
      expect(within(column).queryByRole("button", { name: TRACE })).not.toBeInTheDocument();
      click("Acercar");
      click("Alejar");
      click("Ver Argentina");
      expect(fake.handle.zoomIn).toHaveBeenCalledOnce();
      expect(fake.handle.zoomOut).toHaveBeenCalledOnce();
      expect(fake.handle.resetView).toHaveBeenCalledOnce();
      expect(screen.getByRole("region", { name: "Trazando cerca" })).toBeInTheDocument();
    });

    it("a map that fails mid-drawing takes the mode with it", async () => {
      await renderStage();
      report("ready");
      await startDrawing();
      report("error");
      expect(screen.queryByRole("region", { name: "Trazando cerca" })).not.toBeInTheDocument();
      expect(fake.draft).toBeNull();
    });
  });
});
