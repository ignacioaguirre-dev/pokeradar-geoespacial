import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { BaseMap, type FenceDraftProps, type MapHandle } from "./base-map";
import type { HabitatCollection } from "./habitats";

type Handler = (event?: unknown) => void;

const fake = vi.hoisted(() => {
  class FakeMap {
    static instances: FakeMap[] = [];
    handlers = new Map<string, Handler[]>();
    container: HTMLElement;
    canvasContainer = document.createElement("div");
    canvas = document.createElement("canvas");
    loaded = false;
    data = new Map<string, unknown>();
    doubleClickZoom = { enable: vi.fn(), disable: vi.fn() };
    touchZoomRotate = { disableRotation: vi.fn() };
    setPadding = vi.fn();
    constructor(public options: { container: HTMLElement; style: { sources: Record<string, unknown> } }) {
      this.container = options.container;
      this.canvasContainer.appendChild(this.canvas);
      this.container.appendChild(this.canvasContainer);
      // A 400 × 300 canvas centered on (-60, -30)
      Object.defineProperties(this.canvas, { clientWidth: { value: 400 }, clientHeight: { value: 300 } });
      this.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
      FakeMap.instances.push(this);
    }
    on(type: string, handler: Handler) {
      this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      return this;
    }
    off() {
      return this;
    }
    once() {
      return this;
    }
    emit(type: string) {
      if (type === "load") this.loaded = true;
      for (const handler of this.handlers.get(type) ?? []) handler();
    }
    getCanvas() {
      return this.canvas;
    }
    getCanvasContainer() {
      return this.canvasContainer;
    }
    getContainer() {
      return this.container;
    }
    getZoom() {
      return 5;
    }
    getCenter() {
      return { lng: -60, lat: -30 };
    }
    // One degree every 10 px, centered on (-60, -30)
    unproject([x, y]: [number, number]) {
      return { lng: -60 + (x - 200) / 10, lat: -30 - (y - 150) / 10 };
    }
    project({ lng, lat }: { lng: number; lat: number }) {
      return { x: 200 + (lng + 60) * 10, y: 150 - (lat + 30) * 10 };
    }
    getSource(id: string) {
      if (!this.loaded || !(id in this.options.style.sources)) return undefined;
      return { setData: (data: unknown) => this.data.set(id, data) };
    }
    remove() {}
  }
  return { FakeMap };
});

vi.mock("maplibre-gl", () => ({ Map: fake.FakeMap, setWorkerUrl: vi.fn() }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("./colors", () => ({
  readMapColors: () => ({
    sea: "s",
    land: "l",
    coast: "c",
    border: "b",
    province: "p",
    label: "t",
    city: "y",
    sighting: "g",
    sweep: "#e6d3b0",
    trace: "#d9a55b",
    space: "k",
    biome: { forest: "f", grassland: "g", "waters-edge": "w", mountain: "m", "rough-terrain": "r", sea: "s" },
  }),
}));

const labels = { region: "Mapa de Argentina", keyboardHelp: "Usá las flechas." };
const habitats: HabitatCollection = { type: "FeatureCollection", features: [] };
const padding = { top: 0, right: 0, bottom: 0, left: 0 };

function lastMap() {
  const map = fake.FakeMap.instances.at(-1);
  if (!map) throw new Error("no map was created");
  return map;
}

function renderMap(draft: FenceDraftProps | null) {
  const ref = createRef<MapHandle>();
  const view = render(
    <BaseMap ref={ref} habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} draft={draft} />,
  );
  act(() => lastMap().emit("load"));
  const rerender = (next: FenceDraftProps | null) =>
    view.rerender(
      <BaseMap ref={ref} habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} draft={next} />,
    );
  return { ...view, ref, rerender };
}

function press(type: string, x: number, y: number, t: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: "touch" }, timeStamp: { value: t } });
  lastMap().canvas.dispatchEvent(event);
}

let onPoint: ReturnType<typeof vi.fn<(point: LngLat) => void>>;
const draft = (ring: Ring = []): FenceDraftProps => ({ ring, onPoint });

beforeEach(() => {
  fake.FakeMap.instances = [];
  onPoint = vi.fn();
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BaseMap while drawing a fence", () => {
  it("a tap becomes a point where it landed", () => {
    renderMap(draft());
    press("pointerdown", 300, 50, 0);
    press("pointerup", 300, 50, 80);
    expect(onPoint).toHaveBeenCalledWith([-50, -20]);
  });

  it("a drag only moves the map", () => {
    renderMap(draft());
    press("pointerdown", 300, 50, 0);
    press("pointerup", 360, 90, 80);
    expect(onPoint).not.toHaveBeenCalled();
  });

  it("Enter on the map adds the point under the reticle", () => {
    renderMap(draft());
    lastMap().canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onPoint).toHaveBeenCalledWith([-60, -30]);
  });

  it("the handle reads the reticle's point for «Sumar punto acá»", () => {
    const { ref } = renderMap(draft());
    expect(ref.current?.reticlePoint()).toEqual([-60, -30]);
  });

  it("draws the vertices it is given", () => {
    const ring: Ring = [
      [-60, -30],
      [-59, -30],
      [-59, -29],
    ];
    renderMap(draft(ring));
    const data = lastMap().data.get("fence-draft") as { features: { properties: { part: string } }[] };
    expect(data.features.map((f) => f.properties.part)).toEqual(["edge", "closing", "vertex", "vertex", "vertex"]);
  });

  it("shows the reticle over the map's center and marks the map, and keeps double taps from zooming", () => {
    const { container } = renderMap(draft());
    const reticle = container.querySelector<SVGElement>("[data-reticle]");
    expect(reticle?.style.translate).toBe("200px 150px");
    expect(reticle?.style.visibility).toBe("visible");
    expect(container.querySelector("[data-map]")).toHaveAttribute("data-drawing");
    expect(lastMap().doubleClickZoom.disable).toHaveBeenCalled();
  });

  it("leaving the mode clears the draft and gives taps and Enter back to the map", () => {
    const { container, rerender } = renderMap(draft([[-60, -30]]));
    rerender(null);
    expect(lastMap().data.get("fence-draft")).toEqual({ type: "FeatureCollection", features: [] });
    expect(container.querySelector("[data-reticle]")).toBeNull();
    expect(container.querySelector("[data-map]")).not.toHaveAttribute("data-drawing");
    expect(lastMap().doubleClickZoom.enable).toHaveBeenCalled();
    press("pointerdown", 300, 50, 0);
    press("pointerup", 300, 50, 80);
    lastMap().canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onPoint).not.toHaveBeenCalled();
  });

  it("outside the mode a tap is nothing", () => {
    renderMap(null);
    press("pointerdown", 300, 50, 0);
    press("pointerup", 300, 50, 80);
    expect(onPoint).not.toHaveBeenCalled();
  });
});
