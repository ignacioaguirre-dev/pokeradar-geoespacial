import { fireEvent } from "@testing-library/react";
import { act, type Ref } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import type { MapStatus } from "@/map/base-map";
import { introPlayed } from "./intro-played";
import { MapStage } from "./map-stage";

type Padding = { top: number; right: number; bottom: number; left: number };

const fake = vi.hoisted(() => ({
  mounts: 0,
  active: 0,
  onStatusChange: null as ((status: "ready" | "error") => void) | null,
  padding: null as { top: number; right: number; bottom: number; left: number } | null,
  habitats: null as { features: { properties: { habitat: string } }[] } | null,
  sightings: undefined as readonly (readonly [number, number, number])[] | undefined,
  intro: undefined as boolean | undefined,
  // The latest intro prop, while `intro` keeps the one the map was created with
  introNow: undefined as boolean | undefined,
  onIntroEnd: undefined as (() => void) | undefined,
  handle: { zoomIn: () => {}, zoomOut: () => {}, resetView: () => {}, skipIntro: () => {}, focus: () => {} },
  webgl2: true,
  // While pending, the map suspends as if its chunk were still downloading
  chunk: null as Promise<void> | null,
}));

vi.mock("@/map/base-map", async () => {
  const { use, useEffect, useImperativeHandle, useState } = await import("react");
  function BaseMap({
    habitats,
    sightings,
    padding,
    intro,
    onIntroEnd,
    onStatusChange,
    ref,
  }: {
    habitats: typeof fake.habitats;
    sightings?: typeof fake.sightings;
    padding: Padding;
    intro?: boolean;
    onIntroEnd?(): void;
    onStatusChange(status: MapStatus): void;
    ref?: Ref<typeof fake.handle>;
  }) {
    if (fake.chunk) use(fake.chunk);
    useEffect(() => {
      fake.onStatusChange = onStatusChange;
      fake.padding = padding;
      fake.habitats = habitats;
      fake.sightings = sightings;
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

vi.mock("@/map/supports-webgl2", () => ({ supportsWebGL2: () => fake.webgl2 }));
// The detail reads the URL through the Next router, which these tests do not mount
vi.mock("./creature-route", () => ({ CreatureRoute: () => null }));

const WIDE = "(min-width: 768px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
let wide = false;
let reduced = true;
const mediaListeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query === WIDE ? wide : query === REDUCED ? reduced : false;
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
    fake.webgl2 = true;
    fake.chunk = null;
    fake.intro = undefined;
    fake.introNow = undefined;
    introPlayed.current = false;
    fake.onIntroEnd = undefined;
    fake.handle = { zoomIn: vi.fn(), zoomOut: vi.fn(), resetView: vi.fn(), skipIntro: vi.fn(), focus: vi.fn() };
    wide = false;
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
    render(<MapStage sightings={Promise.resolve([[25, -58.4, -34.6] as const])} />);
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
    expect(fake.padding).toEqual({ top: 64, right: 12, bottom: 204, left: 12 });
    wide = true;
    act(() => mediaListeners.forEach((listener) => listener()));
    expect(fake.padding).toEqual({ top: 96, right: 120, bottom: 72, left: 120 });
    expect(fake.mounts).toBe(1);
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
      act(() => click(SKIP));
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
  });
});
