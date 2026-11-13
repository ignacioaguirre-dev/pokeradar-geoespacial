import { fireEvent } from "@testing-library/react";
import { act, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/testing/render";
import type { MapStatus } from "@/map/base-map";
import { MapStage } from "./map-stage";

type Padding = { top: number; right: number; bottom: number; left: number };

const fake = vi.hoisted(() => ({
  mounts: 0,
  active: 0,
  onStatusChange: null as ((status: "ready" | "error") => void) | null,
  padding: null as { top: number; right: number; bottom: number; left: number } | null,
  handle: { zoomIn: () => {}, zoomOut: () => {}, resetView: () => {} },
  webgl2: true,
}));

vi.mock("@/map/base-map", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  function BaseMap({
    padding,
    onStatusChange,
    ref,
  }: {
    padding: Padding;
    onStatusChange(status: MapStatus): void;
    ref?: Ref<typeof fake.handle>;
  }) {
    useEffect(() => {
      fake.onStatusChange = onStatusChange;
      fake.padding = padding;
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
vi.mock("./creature-route", () => ({ CreatureRoute: () => null }));

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
  beforeEach(() => {
    vi.useFakeTimers();
    fake.mounts = 0;
    fake.active = 0;
    fake.onStatusChange = null;
    fake.padding = null;
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

  it("updates the map padding when the viewport widens", async () => {
    await renderStage();
    expect(fake.padding).toEqual({ top: 64, right: 12, bottom: 152, left: 12 });
    wide = true;
    act(() => mediaListeners.forEach((listener) => listener()));
    expect(fake.padding).toEqual({ top: 96, right: 120, bottom: 72, left: 120 });
    expect(fake.mounts).toBe(1);
  });
});
