import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseMap, type MapHandle } from "./base-map";
import { INTRO_PROJECTION } from "./intro-flight";
import type { HabitatCollection } from "./habitats";

type Handler = (event?: unknown) => void;

const fake = vi.hoisted(() => {
  class FakeMap {
    static instances: FakeMap[] = [];
    static throwOnCreate = false;
    handlers = new Map<string, Handler[]>();
    removed = 0;
    setPadding = vi.fn();
    panBy = vi.fn();
    easeTo = vi.fn();
    // Screen points stand in for coordinates, so `around` shows where the cursor was
    unproject = vi.fn(([x, y]: [number, number]) => ({ lng: x, lat: y }));
    touchZoomRotate = { disableRotation: vi.fn() };
    canvas: HTMLCanvasElement;

    constructor(
      public options: {
        container: HTMLElement;
        scrollZoom?: boolean;
        locale: Record<string, string>;
        style: { sources: Record<string, { data?: unknown }>; projection?: unknown };
      },
    ) {
      if (FakeMap.throwOnCreate) throw new Error("Failed to initialize WebGL");
      // MapLibre appends its own focusable canvas, names it from the locale and marks it as a region
      this.canvas = document.createElement("canvas");
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute("role", "region");
      this.canvas.setAttribute("aria-label", options.locale["Map.Title"]);
      options.container.appendChild(this.canvas);
      FakeMap.instances.push(this);
    }
    on(type: string, handler: Handler) {
      this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      return this;
    }
    emit(type: string, event?: unknown) {
      if (type === "load") this.loaded = true;
      for (const handler of this.handlers.get(type) ?? []) handler(event);
    }
    getCanvas() {
      return this.canvas;
    }
    getCanvasContainer() {
      return this.options.container;
    }
    getZoom() {
      return 3.14159;
    }
    getMinZoom() {
      return 2;
    }
    getMaxZoom() {
      return 22;
    }
    getCenter() {
      return { lng: -64.123, lat: -38.456 };
    }
    // MapLibre only exposes the style's sources once it has loaded
    loaded = false;
    setData = vi.fn();
    getSource(id: string) {
      return this.loaded && id in this.options.style.sources ? { setData: this.setData } : undefined;
    }
    remove() {
      this.removed += 1;
    }
  }
  return { FakeMap };
});

const flight = vi.hoisted(() => ({
  start: vi.fn(),
  cancel: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({ Map: fake.FakeMap, setWorkerUrl: vi.fn() }));
vi.mock("./intro-flight", async (original) => ({
  ...(await original<typeof import("./intro-flight")>()),
  startIntroFlight: flight.start,
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("./colors", () => ({
  readMapColors: () => ({
    sea: "marker-sea",
    land: "marker-land",
    coast: "marker-coast",
    border: "marker-border",
    province: "marker-province",
    label: "marker-label",
    city: "marker-city",
    sighting: "marker-sighting",
    space: "marker-space",
    biome: {
      forest: "marker-forest",
      grassland: "marker-grassland",
      "waters-edge": "marker-waters-edge",
      mountain: "marker-mountain",
      "rough-terrain": "marker-rough-terrain",
      sea: "marker-sea-habitat",
    },
  }),
}));

const labels = { region: "Mapa de Argentina", keyboardHelp: "Usá las flechas para mover el mapa." };
const habitats: HabitatCollection = { type: "FeatureCollection", features: [] };
const padding = { top: 10, right: 20, bottom: 30, left: 40 };

function lastMap() {
  const map = fake.FakeMap.instances.at(-1);
  if (!map) throw new Error("no map was created");
  return map;
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = (query: string) => ({ matches: reduce && query.includes("reduce") }) as MediaQueryList;
}

// Dispatched where MapLibre's canvas container receives it; returns whether the page scroll was cancelled
function wheel(init: WheelEventInit): boolean {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  lastMap().getCanvas().dispatchEvent(event);
  return event.defaultPrevented;
}

describe("BaseMap", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    fake.FakeMap.instances = [];
    fake.FakeMap.throwOnCreate = false;
    flight.cancel.mockReset();
    flight.dispose.mockReset();
    flight.start.mockReset().mockReturnValue({ cancel: flight.cancel, dispose: flight.dispose });
    setReducedMotion(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("hands the sightings to the style", () => {
    render(
      <BaseMap
        habitats={habitats}
        sightings={[[25, -58.4, -34.6]]}
        labels={labels}
        padding={padding}
        onStatusChange={vi.fn()}
      />,
    );
    expect(lastMap().options.style.sources.sightings.data).toMatchObject({ features: [{ properties: { speciesId: 25 } }] });
  });

  // They stream in after the map was created (or never, when the catalog is down)
  it("updates the sightings that arrive after load without recreating the map", () => {
    const props = { habitats, labels, padding, onStatusChange: vi.fn() };
    const { rerender } = render(<BaseMap {...props} />);
    lastMap().emit("load");
    rerender(<BaseMap {...props} sightings={[[25, -58.4, -34.6]]} />);
    expect(fake.FakeMap.instances).toHaveLength(1);
    expect(lastMap().setData).toHaveBeenCalledWith(
      expect.objectContaining({ features: [expect.objectContaining({ properties: { speciesId: 25 } })] }),
    );
  });

  it("applies sightings that arrive before load once the style is ready", () => {
    const props = { habitats, labels, padding, onStatusChange: vi.fn() };
    const { rerender } = render(<BaseMap {...props} />);
    rerender(<BaseMap {...props} sightings={[[7, -60.1, -45.2]]} />);
    expect(lastMap().setData).not.toHaveBeenCalled();
    lastMap().emit("load");
    expect(lastMap().setData).toHaveBeenCalledOnce();
    expect(lastMap().setData).toHaveBeenCalledWith(
      expect.objectContaining({ features: [expect.objectContaining({ properties: { speciesId: 7 } })] }),
    );
  });

  it("does not reload sightings the style already has", () => {
    render(
      <BaseMap habitats={habitats} sightings={[[25, -58.4, -34.6]]} labels={labels} padding={padding} onStatusChange={vi.fn()} />,
    );
    lastMap().emit("load");
    expect(lastMap().setData).not.toHaveBeenCalled();
  });

  it("hands the habitats to the style", () => {
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
    expect(lastMap().options.style.sources.habitats.data).toBe(habitats);
  });

  it("reports ready on load", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("load");
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("ready");
  });

  it("reports error before load", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("error", { error: new Error("style failed") });
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("error");
  });

  it("keeps the error when load follows a startup error", () => {
    // MapLibre still fires load after the TileJSON fails, leaving a map that never gets tiles
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("error", { error: new Error("source failed") });
    lastMap().emit("load");
    lastMap().emit("webglcontextlost");
    lastMap().emit("webglcontextrestored");
    expect(onStatusChange).not.toHaveBeenCalledWith("ready");
  });

  it("ignores a single tile failure before load", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("error", { error: new Error("tile failed"), tile: {} });
    lastMap().emit("load");
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("ready");
  });

  it("ignores errors after load", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("load");
    lastMap().emit("error", { error: new Error("tile failed") });
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("ready");
  });

  it("reports error when the WebGL context is lost", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("load");
    lastMap().emit("webglcontextlost");
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
  });

  it("reports ready again when the WebGL context is restored", () => {
    const onStatusChange = vi.fn();
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    lastMap().emit("load");
    lastMap().emit("webglcontextlost");
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    lastMap().emit("webglcontextrestored");
    expect(onStatusChange).toHaveBeenLastCalledWith("ready");
  });

  it("reports error when the map cannot be created", () => {
    fake.FakeMap.throwOnCreate = true;
    const onStatusChange = vi.fn();
    const { unmount } = render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={onStatusChange} />);
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("error");
    expect(() => unmount()).not.toThrow();
  });

  it("removes the map on unmount", () => {
    const { unmount } = render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
    unmount();
    expect(lastMap().removed).toBe(1);
  });

  it("does not recreate the map when props change", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={first} />);
    const next = { top: 1, right: 2, bottom: 3, left: 4 };
    rerender(<BaseMap habitats={habitats} labels={labels} padding={next} onStatusChange={second} />);
    expect(fake.FakeMap.instances).toHaveLength(1);
    expect(lastMap().setPadding).toHaveBeenLastCalledWith(next);
    lastMap().emit("load");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("ready");
  });

  it("exposes the keyboard help on the canvas", () => {
    render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
    const canvas = screen.getByRole("application", { name: labels.region });
    expect(canvas).toHaveAccessibleDescription(labels.keyboardHelp);
  });

  describe("wheel gestures", () => {
    function renderMap() {
      return render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
    }

    it("turns off MapLibre's scroll zoom, which reads every wheel as zoom", () => {
      renderMap();
      expect(lastMap().options.scrollZoom).toBe(false);
    });

    it("pans with a two-finger touchpad swipe", () => {
      renderMap();
      expect(wheel({ deltaX: 30, deltaY: -12.5 })).toBe(true);
      expect(lastMap().panBy).toHaveBeenCalledOnce();
      expect(lastMap().panBy.mock.lastCall?.slice(0, 2)).toEqual([[30, -12.5], { animate: false }]);
      expect(lastMap().easeTo).not.toHaveBeenCalled();
    });

    it("zooms around the cursor with a mouse wheel", () => {
      renderMap();
      expect(wheel({ deltaY: -100, clientX: 120, clientY: 80 })).toBe(true);
      expect(lastMap().panBy).not.toHaveBeenCalled();
      expect(lastMap().unproject).toHaveBeenCalledWith([120, 80]);
      const [options] = lastMap().easeTo.mock.lastCall ?? [];
      expect(options).toMatchObject({ around: { lng: 120, lat: 80 }, animate: true });
      expect(options.zoom).toBeGreaterThan(3.14159);
    });

    it("zooms around the cursor on a touchpad pinch, which arrives with ctrlKey", () => {
      renderMap();
      expect(wheel({ deltaY: 4.5, ctrlKey: true, clientX: 50, clientY: 60 })).toBe(true);
      expect(lastMap().panBy).not.toHaveBeenCalled();
      const [options] = lastMap().easeTo.mock.lastCall ?? [];
      expect(options).toMatchObject({ around: { lng: 50, lat: 60 } });
      expect(options.zoom).toBeLessThan(3.14159);
    });

    it("zooms without animation under reduced motion", () => {
      setReducedMotion(true);
      renderMap();
      wheel({ deltaY: -100 });
      expect(lastMap().easeTo.mock.lastCall?.[0]).toMatchObject({ animate: false });
    });

    it("adds up mouse ticks that arrive while the zoom is still easing", () => {
      renderMap();
      wheel({ deltaY: -100 });
      const first = lastMap().easeTo.mock.lastCall?.[0].zoom;
      wheel({ deltaY: -100 });
      const second = lastMap().easeTo.mock.lastCall?.[0].zoom;
      expect(second - 3.14159).toBeCloseTo(2 * (first - 3.14159));
    });

    it("leaves the page alone when there is nothing to move", () => {
      renderMap();
      expect(wheel({ deltaX: 0, deltaY: 0 })).toBe(false);
    });

    it("stops listening on unmount", () => {
      const { unmount } = renderMap();
      const map = lastMap();
      unmount();
      map.getCanvas().dispatchEvent(new WheelEvent("wheel", { deltaX: 30, bubbles: true, cancelable: true }));
      expect(map.panBy).not.toHaveBeenCalled();
    });

    describe("data-center", () => {
      let frames: Map<number, FrameRequestCallback>;
      let nextFrame: number;

      beforeEach(() => {
        frames = new Map();
        nextFrame = 1;
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
          frames.set(nextFrame, callback);
          return nextFrame++;
        });
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
          frames.delete(id);
        });
      });

      afterEach(() => vi.restoreAllMocks());

      function runFrames() {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback(0);
      }

      it("writes the rounded center for the end-to-end tests", () => {
        renderMap();
        lastMap().emit("moveend");
        runFrames();
        expect(lastMap().options.container).toHaveAttribute("data-center", "-64.12,-38.46");
      });

      // An unanimated touchpad pan fires moveend on every wheel event
      it("writes it at most once per frame", () => {
        renderMap();
        const getCenter = vi.spyOn(lastMap(), "getCenter");
        for (let i = 0; i < 5; i++) lastMap().emit("moveend");
        expect(lastMap().options.container).not.toHaveAttribute("data-center");
        expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
        runFrames();
        expect(getCenter).toHaveBeenCalledOnce();
        lastMap().emit("moveend");
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
      });

      it("cancels a pending write on unmount", () => {
        const { unmount } = renderMap();
        lastMap().emit("moveend");
        unmount();
        expect(window.cancelAnimationFrame).toHaveBeenCalledOnce();
        expect(frames.size).toBe(0);
      });
    });

    // Reading the size forces layout; only page deltas need it
    it("reads the container height only for page deltas", () => {
      renderMap();
      const height = vi.fn(() => 500);
      Object.defineProperty(lastMap().options.container, "clientHeight", { configurable: true, get: height });
      wheel({ deltaX: 30, deltaY: 12.5 });
      wheel({ deltaY: -100 });
      expect(height).not.toHaveBeenCalled();
      wheel({ deltaX: 1, deltaY: 1, deltaMode: 2 });
      expect(height).toHaveBeenCalled();
      expect(lastMap().panBy.mock.lastCall?.[0]).toEqual([500, 500]);
    });

    it("asks for the reduced motion query once, not on every wheel event", () => {
      const matchMedia = vi.fn((query: string) => ({ matches: false, media: query }) as MediaQueryList);
      window.matchMedia = matchMedia;
      renderMap();
      for (let i = 0; i < 3; i++) wheel({ deltaY: -100 });
      expect(matchMedia.mock.calls.filter(([query]) => query.includes("reduce"))).toHaveLength(1);
    });

    // MapLibre only puts originalEvent on movestart when the caller hands it over
    it("marks its moves as coming from the person", () => {
      renderMap();
      wheel({ deltaX: 30 });
      expect(lastMap().panBy.mock.lastCall?.[2]).toEqual({ originalEvent: expect.any(WheelEvent) });
    });

    it("marks its zooms as coming from the person", () => {
      renderMap();
      wheel({ deltaY: -100 });
      expect(lastMap().easeTo.mock.lastCall?.[1]).toEqual({ originalEvent: expect.any(WheelEvent) });
    });
  });

  describe("input detection", () => {
    function renderMap() {
      const onInputDetected = vi.fn();
      const onInteract = vi.fn();
      const result = render(
        <BaseMap
          habitats={habitats}
          labels={labels}
          padding={padding}
          onStatusChange={vi.fn()}
          onInputDetected={onInputDetected}
          onInteract={onInteract}
        />,
      );
      return { ...result, onInputDetected, onInteract };
    }

    function pointerDown(pointerType: string) {
      lastMap().getCanvas().dispatchEvent(new PointerEvent("pointerdown", { pointerType, bubbles: true }));
    }

    it("reports touch on a finger down", () => {
      const { onInputDetected } = renderMap();
      pointerDown("touch");
      expect(onInputDetected).toHaveBeenCalledExactlyOnceWith("touch");
    });

    // A touchpad click also arrives as a mouse pointer, so only the wheel can tell them apart
    it("does not guess from a mouse pointer", () => {
      const { onInputDetected } = renderMap();
      pointerDown("mouse");
      pointerDown("pen");
      expect(onInputDetected).not.toHaveBeenCalled();
    });

    it("reports a touchpad gesture once", () => {
      const { onInputDetected } = renderMap();
      wheel({ deltaX: 30 });
      wheel({ deltaX: 12 });
      expect(onInputDetected).toHaveBeenCalledExactlyOnceWith("touchpad");
    });

    it("reports a mouse wheel", () => {
      const { onInputDetected } = renderMap();
      wheel({ deltaY: -100 });
      expect(onInputDetected).toHaveBeenCalledExactlyOnceWith("mouse");
    });

    it("reports the correction when a gesture turns out to be a touchpad", () => {
      const { onInputDetected } = renderMap();
      wheel({ deltaY: 75 });
      wheel({ deltaY: 7.25 });
      expect(onInputDetected.mock.calls).toEqual([["mouse"], ["touchpad"]]);
    });

    it("reports an interaction when the person moves the map", () => {
      const { onInteract } = renderMap();
      lastMap().emit("movestart", { originalEvent: new MouseEvent("mousedown") });
      expect(onInteract).toHaveBeenCalledOnce();
    });

    // The initial fit and the control buttons move the map from code
    it("ignores moves made from code", () => {
      const { onInteract } = renderMap();
      lastMap().emit("movestart", {});
      lastMap().emit("movestart", { originalEvent: undefined });
      expect(onInteract).not.toHaveBeenCalled();
    });

    it("stops listening for fingers on unmount", () => {
      const { unmount, onInputDetected } = renderMap();
      const canvas = lastMap().getCanvas();
      unmount();
      canvas.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
      expect(onInputDetected).not.toHaveBeenCalled();
    });
  });

  describe("entry flight", () => {
    it("stays flat and still without intro", () => {
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
      expect(lastMap().options.style.projection).toBeUndefined();
      expect(flight.start).not.toHaveBeenCalled();
    });

    it("starts from the globe with intro and reports its end", () => {
      const onIntroEnd = vi.fn();
      render(
        <BaseMap
          habitats={habitats}
          labels={labels}
          padding={padding}
          intro
          onIntroEnd={onIntroEnd}
          onStatusChange={vi.fn()}
        />,
      );
      expect(lastMap().options.style.projection).toEqual(INTRO_PROJECTION);
      expect(flight.start).toHaveBeenCalledOnce();
      const [map, options] = flight.start.mock.calls[0] as [unknown, { rimColor: string; onEnd(): void }];
      expect(map).toBe(lastMap());
      // The globe's edge is drawn with the coastline's token
      expect(options.rimColor).toBe("marker-coast");
      expect(onIntroEnd).not.toHaveBeenCalled();
      options.onEnd();
      expect(onIntroEnd).toHaveBeenCalledOnce();
    });

    // The map is usable while it flies; the flight does not hold the status back
    it("reports ready on load while flying", () => {
      const onStatusChange = vi.fn();
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={onStatusChange} />);
      lastMap().emit("load");
      expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("ready");
    });

    it("skipIntro cancels the flight and focus moves to the canvas", () => {
      const ref = createRef<MapHandle>();
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} ref={ref} />);
      act(() => ref.current?.skipIntro());
      expect(flight.cancel).toHaveBeenCalledOnce();
      act(() => ref.current?.focus());
      expect(document.activeElement).toBe(screen.getByRole("application", { name: labels.region }));
    });

    // MapLibre still fires load after a failed source, which would start the flight and draw the globe's rim
    it("ends the flight when the map fails before load, so it never starts", () => {
      const onIntroEnd = vi.fn();
      render(
        <BaseMap
          habitats={habitats}
          labels={labels}
          padding={padding}
          intro
          onIntroEnd={onIntroEnd}
          onStatusChange={vi.fn()}
        />,
      );
      flight.cancel.mockImplementation(() => flight.start.mock.calls[0][1].onEnd());
      lastMap().emit("error", { error: new Error("source failed") });
      expect(flight.cancel).toHaveBeenCalledOnce();
      expect(onIntroEnd).toHaveBeenCalledOnce();
    });

    it("ends the flight when the WebGL context is lost mid-flight", () => {
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />);
      lastMap().emit("load");
      lastMap().emit("webglcontextlost");
      expect(flight.cancel).toHaveBeenCalledOnce();
    });

    it("keeps flying through a single tile failure", () => {
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />);
      lastMap().emit("error", { error: new Error("tile failed"), tile: {} });
      lastMap().emit("load");
      lastMap().emit("error", { error: new Error("tile failed") });
      expect(flight.cancel).not.toHaveBeenCalled();
    });

    it("detaches the flight before removing the map", () => {
      const { unmount } = render(
        <BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />,
      );
      unmount();
      expect(flight.dispose).toHaveBeenCalledOnce();
      expect(flight.cancel).not.toHaveBeenCalled();
      expect(lastMap().removed).toBe(1);
    });

    // The flight's capture listener usually ends it first; the wheel handler makes sure a still flying camera
    // is never panned or zoomed
    it("ends the flight before a wheel pans the map", () => {
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />);
      wheel({ deltaX: 30 });
      expect(flight.cancel).toHaveBeenCalledOnce();
      expect(lastMap().panBy).toHaveBeenCalledOnce();
      expect(flight.cancel.mock.invocationCallOrder[0]).toBeLessThan(lastMap().panBy.mock.invocationCallOrder[0]);
    });

    it("ends the flight before a wheel zooms the map", () => {
      render(<BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />);
      wheel({ deltaY: -100 });
      expect(flight.cancel).toHaveBeenCalledOnce();
      expect(lastMap().easeTo).toHaveBeenCalledOnce();
      expect(flight.cancel.mock.invocationCallOrder[0]).toBeLessThan(lastMap().easeTo.mock.invocationCallOrder[0]);
    });
  });
});
