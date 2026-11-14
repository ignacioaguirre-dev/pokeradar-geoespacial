import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    touchZoomRotate = { disableRotation: vi.fn() };
    canvas: HTMLCanvasElement;

    constructor(
      public options: {
        container: HTMLElement;
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
    getZoom() {
      return 3.14159;
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

describe("BaseMap", () => {
  beforeEach(() => {
    fake.FakeMap.instances = [];
    fake.FakeMap.throwOnCreate = false;
    flight.cancel.mockReset();
    flight.dispose.mockReset();
    flight.start.mockReset().mockReturnValue({ cancel: flight.cancel, dispose: flight.dispose });
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

    it("detaches the flight before removing the map", () => {
      const { unmount } = render(
        <BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} />,
      );
      unmount();
      expect(flight.dispose).toHaveBeenCalledOnce();
      expect(flight.cancel).not.toHaveBeenCalled();
      expect(lastMap().removed).toBe(1);
    });
  });
});
