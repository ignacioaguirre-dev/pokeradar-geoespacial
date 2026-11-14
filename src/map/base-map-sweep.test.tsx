import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { BaseMap, type MapHandle, type SweepProps } from "./base-map";
import type { HabitatCollection } from "./habitats";

type Handler = (event?: unknown) => void;

const fake = vi.hoisted(() => {
  class FakeMarker {
    static instances: FakeMarker[] = [];
    lngLat: [number, number] = [0, 0];
    removed = false;
    constructor(public options: { element: HTMLElement; anchor?: string }) {
      FakeMarker.instances.push(this);
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat;
      return this;
    }
    addTo(map: { container: HTMLElement }) {
      map.container.appendChild(this.options.element);
      return this;
    }
    remove() {
      this.removed = true;
      this.options.element.remove();
      return this;
    }
  }

  class FakeMap {
    static instances: FakeMap[] = [];
    handlers = new Map<string, Handler[]>();
    container: HTMLElement;
    canvas = document.createElement("canvas");
    loaded = false;
    removed = false;
    zoom = 5;
    // Pixels per degree of the projection below; small values pack the markers together
    scale = 100;
    data = new Map<string, unknown>();
    paint = new Map<string, unknown>();
    setPadding = vi.fn();
    fitBounds = vi.fn();
    flyTo = vi.fn();
    jumpTo = vi.fn();
    easeTo = vi.fn();
    panBy = vi.fn();
    touchZoomRotate = { disableRotation: vi.fn() };

    constructor(public options: { container: HTMLElement; style: { sources: Record<string, unknown> } }) {
      this.container = options.container;
      this.container.appendChild(this.canvas);
      FakeMap.instances.push(this);
    }
    on(type: string, handler: Handler) {
      this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      return this;
    }
    // Like MapLibre, off() also drops a listener registered with once()
    once(type: string, handler: Handler) {
      const wrapped = Object.assign((event?: unknown) => {
        this.off(type, handler);
        handler(event);
      }, { original: handler });
      return this.on(type, wrapped);
    }
    off(type: string, handler: Handler) {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter(
          (h) => h !== handler && (h as { original?: Handler }).original !== handler,
        ),
      );
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
      return this.container;
    }
    getMinZoom() {
      return 2;
    }
    getMaxZoom() {
      return 22;
    }
    getCenter() {
      return { lng: -64, lat: -38 };
    }
    unproject([x, y]: [number, number]) {
      return { lng: x / this.scale, lat: -y / this.scale };
    }
    getZoom() {
      return this.zoom;
    }
    project([lng, lat]: [number, number]) {
      return { x: lng * this.scale, y: -lat * this.scale };
    }
    getSource(id: string) {
      if (!this.loaded || !(id in this.options.style.sources)) return undefined;
      return { setData: (data: unknown) => this.data.set(id, data) };
    }
    setPaintProperty(layer: string, property: string, value: unknown) {
      if (this.removed) throw new Error("map removed");
      this.paint.set(`${layer}.${property}`, value);
    }
    remove() {
      this.removed = true;
    }
  }
  return { FakeMap, FakeMarker };
});

vi.mock("maplibre-gl", () => ({ Map: fake.FakeMap, Marker: fake.FakeMarker, setWorkerUrl: vi.fn() }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
// The flight itself is covered in intro-flight.test.ts; here only whether the sweep ends it first
const flight = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), dispose: vi.fn() }));
vi.mock("./intro-flight", async (original) => ({
  ...(await original<typeof import("./intro-flight")>()),
  startIntroFlight: flight.start,
}));
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
const padding = { top: 10, right: 20, bottom: 30, left: 40 };

// Centroid at (-57, -29)
const IBERA = {
  id: "ibera",
  ring: [
    [-58, -30],
    [-56, -30],
    [-56, -28],
    [-58, -28],
  ],
} as const;
const PAMPA = {
  id: "pampa",
  ring: [
    [-63, -37],
    [-59, -37],
    [-59, -34],
    [-63, -34],
  ],
} as const;
const CREATURES = [
  { id: 25, point: [-57.2, -28.8], label: "Ver Pikachu", sprite: "https://raw.githubusercontent.com/25.png" },
  { id: 7, point: [-56.5, -29.5], label: "Ver Squirtle", sprite: "https://raw.githubusercontent.com/7.png" },
] as const;
const FENCE_PADDING = { top: 96, right: 120, bottom: 72, left: 336 };
const DETAIL_PADDING = { top: 96, right: 396, bottom: 72, left: 336 };

let reduced = false;
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
let now = 0;

function sweep(overrides: Partial<SweepProps> = {}): SweepProps {
  return {
    fence: IBERA,
    creatures: CREATURES,
    focus: null,
    fencePadding: () => FENCE_PADDING,
    detailPadding: () => DETAIL_PADDING,
    onSelect: vi.fn(),
    onIntent: vi.fn(),
    ...overrides,
  };
}

function renderMap(props: SweepProps | undefined) {
  const view = render(
    <BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} sweep={props} />,
  );
  const rerender = (next: SweepProps | undefined) =>
    view.rerender(
      <BaseMap habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} sweep={next} />,
    );
  return { ...view, rerender };
}

function lastMap() {
  const map = fake.FakeMap.instances.at(-1);
  if (!map) throw new Error("no map was created");
  return map;
}

// The load handler sets state, so map events go through act like any other external event
function emit(type: string, event?: unknown) {
  act(() => lastMap().emit(type, event));
}

function liveMarkers() {
  return fake.FakeMarker.instances.filter((m) => !m.removed);
}

// Runs the queued frames until none is left, moving the clock a frame at a time
function playFrames() {
  for (let guard = 0; frames.size > 0 && guard < 500; guard++) {
    now += 16;
    const queued = [...frames.values()];
    frames.clear();
    for (const callback of queued) callback(now);
  }
}

beforeEach(() => {
  flight.start.mockReset().mockReturnValue({ cancel: flight.cancel, dispose: flight.dispose });
  flight.cancel.mockReset();
  flight.dispose.mockReset();
  fake.FakeMap.instances = [];
  fake.FakeMarker.instances = [];
  reduced = false;
  frames = new Map();
  now = 0;
  document.documentElement.style.setProperty("--duration-sweep", "900ms");
  document.documentElement.style.setProperty("--curve-out", "cubic-bezier(0.2, 0.9, 0.3, 1)");
  window.matchMedia = (query: string) =>
    ({ matches: query.includes("reduce") && reduced, addEventListener() {}, removeEventListener() {} }) as never;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BaseMap sweep", () => {
  it("draws the chosen fence and frames it with the fence padding", () => {
    renderMap(sweep());
    emit("load");
    expect(lastMap().data.get("sweep-fence")).toEqual({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [...IBERA.ring, IBERA.ring[0]] },
    });
    expect(lastMap().fitBounds).toHaveBeenCalledWith(
      [
        [-58, -30],
        [-56, -28],
      ],
      expect.objectContaining({ padding: FENCE_PADDING, absolutePadding: true, animate: true }),
    );
  });

  it("traces a curve from the fence's center to each creature", () => {
    renderMap(sweep());
    emit("load");
    const traces = lastMap().data.get("sweep-traces") as {
      features: { properties: { id: number }; geometry: { coordinates: number[][] } }[];
    };
    expect(traces.features.map((f) => f.properties.id)).toEqual([25, 7]);
    for (const [i, feature] of traces.features.entries()) {
      expect(feature.geometry.coordinates[0]).toEqual([-57, -29]);
      expect(feature.geometry.coordinates.at(-1)).toEqual(CREATURES[i].point);
    }
    expect(lastMap().data.get("sweep-rings")).toMatchObject({ geometry: { coordinates: [-57, -29] } });
  });

  it("waits for the camera, expands the rings frame by frame and then places the markers", () => {
    renderMap(sweep());
    emit("load");
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(liveMarkers()).toHaveLength(0);

    emit("moveend");
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    // A few frames in: the first ring is on its way, the traces not home yet
    for (let i = 0; i < 10; i++) {
      now += 16;
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) callback(now);
    }
    const radius = lastMap().paint.get("sweep-ring-0.circle-radius") as unknown[];
    expect(radius[4]).toBeGreaterThan(0);
    expect(liveMarkers()).toHaveLength(0);

    playFrames();
    expect(liveMarkers().map((m) => m.lngLat)).toEqual(CREATURES.map((c) => c.point));
    expect(lastMap().paint.get("sweep-traces.line-gradient")).toEqual([
      "interpolate",
      ["linear"],
      ["line-progress"],
      0,
      "#d9a55b66",
      1,
      "#d9a55b",
    ]);
  });

  it("markers are buttons named after the creature with its sprite inside", () => {
    renderMap(sweep());
    emit("load");
    emit("moveend");
    playFrames();
    const buttons = screen.getAllByRole("button", { name: /^Ver / });
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Ver Pikachu", "Ver Squirtle"]);
    const sprite = within(buttons[0]).getByRole("presentation", { hidden: true });
    expect(sprite).toHaveAttribute("src", CREATURES[0].sprite);
    expect(sprite).toHaveAttribute("alt", "");
  });

  it("a marker selects its creature on click and announces intent on hover or focus", () => {
    const props = sweep();
    renderMap(props);
    emit("load");
    emit("moveend");
    playFrames();
    const pikachu = screen.getByRole("button", { name: "Ver Pikachu" });
    fireEvent.mouseEnter(pikachu);
    fireEvent.focus(pikachu);
    expect(props.onIntent).toHaveBeenCalledWith(25);
    fireEvent.click(pikachu);
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(25);
  });

  it("another fence clears the markers and the running animation before drawing its own", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    emit("moveend");
    playFrames();
    expect(liveMarkers()).toHaveLength(2);

    rerender(sweep({ fence: PAMPA, creatures: [CREATURES[0]] }));
    emit("moveend");
    now += 16;
    expect(liveMarkers()).toHaveLength(0);
    // The sweep's next frame, and the map writing its new center once
    expect(frames.size).toBe(2);

    rerender(sweep({ fence: IBERA }));
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(frames.size).toBe(1);
    expect((lastMap().data.get("sweep-fence") as { geometry: { coordinates: unknown[] } }).geometry.coordinates).toEqual(
      [...IBERA.ring, IBERA.ring[0]],
    );
  });

  it("no fence leaves the map clean", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    emit("moveend");
    playFrames();
    rerender(sweep({ fence: null, creatures: [] }));
    expect(liveMarkers()).toHaveLength(0);
    const empty = { type: "FeatureCollection", features: [] };
    for (const source of ["sweep-fence", "sweep-rings", "sweep-traces"]) {
      expect(lastMap().data.get(source), source).toEqual(empty);
    }
  });

  it("with reduced motion draws the final state at once, without frames", () => {
    reduced = true;
    renderMap(sweep());
    emit("load");
    expect(lastMap().fitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ animate: false }));
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(lastMap().paint.get("sweep-ring-2.circle-stroke-opacity")).toBe(0.7);
    expect(lastMap().paint.get("sweep-traces.line-gradient")).toEqual(
      expect.arrayContaining(["#d9a55b66", "#d9a55b"]),
    );
    expect(liveMarkers()).toHaveLength(2);
  });

  it("unmounting mid-sweep cancels the frame and removes the markers", () => {
    const { unmount } = renderMap(sweep());
    emit("load");
    emit("moveend");
    // The sweep's next frame, and the map writing its new center once
    expect(frames.size).toBe(2);
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("a fence chosen before the map loads is drawn once it loads", () => {
    renderMap(sweep());
    expect(lastMap().fitBounds).not.toHaveBeenCalled();
    emit("load");
    expect(lastMap().fitBounds).toHaveBeenCalledOnce();
  });

  it("flies to a focused creature leaving room for the detail", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    rerender(sweep({ focus: 7 }));
    expect(lastMap().flyTo).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ center: CREATURES[1].point, padding: DETAIL_PADDING }),
    );
    expect(lastMap().flyTo.mock.calls[0][0].zoom).toBeGreaterThanOrEqual(7);
  });

  it("with reduced motion jumps to the focused creature", () => {
    reduced = true;
    const { rerender } = renderMap(sweep());
    emit("load");
    rerender(sweep({ focus: 25 }));
    expect(lastMap().flyTo).not.toHaveBeenCalled();
    expect(lastMap().jumpTo).toHaveBeenCalledWith(expect.objectContaining({ center: CREATURES[0].point }));
  });

  it("does not fly to a creature outside the sweep", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    rerender(sweep({ focus: 150 }));
    expect(lastMap().flyTo).not.toHaveBeenCalled();
  });

  // fitBounds and flyTo leave their padding on the map: closing the detail must give the base one back
  it("closing the detail eases back to the base padding", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    rerender(sweep({ focus: 7 }));
    expect(lastMap().easeTo).not.toHaveBeenCalled();
    rerender(sweep({ focus: null }));
    expect(lastMap().easeTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ padding }));
  });

  it("Ver Argentina frames the country with the base padding, whatever a sweep left", () => {
    const ref = createRef<MapHandle>();
    render(<BaseMap ref={ref} habitats={habitats} labels={labels} padding={padding} onStatusChange={vi.fn()} />);
    emit("load");
    act(() => ref.current?.resetView());
    expect(lastMap().fitBounds).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ padding, absolutePadding: true }),
    );
  });

  it("tapping the marker of the creature already open flies back to it", () => {
    const props = sweep({ focus: 25 });
    renderMap(props);
    emit("load");
    emit("moveend");
    playFrames();
    lastMap().flyTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ver Pikachu" }));
    expect(lastMap().flyTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ center: CREATURES[0].point }));
  });

  it("the same creatures in a new list do not replay the sweep", () => {
    const { rerender } = renderMap(sweep());
    emit("load");
    rerender(sweep({ creatures: CREATURES.map((c) => ({ ...c })) }));
    expect(lastMap().fitBounds).toHaveBeenCalledOnce();
  });

  describe("adaptive framing", () => {
    const CREATURES_BOUNDS = [
      [-57.2, -29.5],
      [-56.5, -28.8],
    ];
    // The interface padding plus half a 48 px marker, so the outermost ones are not cut by an edge
    const CREATURES_PADDING = { top: 120, right: 144, bottom: 96, left: 360 };

    it("markers that would overlap: the camera closes in on the detected creatures", () => {
      renderMap(sweep());
      emit("load");
      // About 20 px between the two creatures: their 48 px rings would overlap
      lastMap().scale = 20;
      emit("moveend");
      playFrames();
      expect(liveMarkers()).toHaveLength(2);
      expect(lastMap().fitBounds).toHaveBeenCalledTimes(2);
      expect(lastMap().fitBounds).toHaveBeenLastCalledWith(
        CREATURES_BOUNDS,
        expect.objectContaining({ padding: CREATURES_PADDING, absolutePadding: true, animate: true }),
      );
    });

    // Two creatures a few metres apart would otherwise send the camera down to street level
    it("closes in no further than a regional view", () => {
      renderMap(sweep());
      emit("load");
      lastMap().scale = 20;
      emit("moveend");
      playFrames();
      const options = lastMap().fitBounds.mock.calls[1][1];
      expect(options.maxZoom).toBeGreaterThanOrEqual(7);
      expect(options.maxZoom).toBeLessThanOrEqual(10);
    });

    it("markers well apart keep the fence framing", () => {
      renderMap(sweep());
      emit("load");
      emit("moveend");
      playFrames();
      expect(liveMarkers()).toHaveLength(2);
      expect(lastMap().fitBounds).toHaveBeenCalledOnce();
    });

    it("with reduced motion the closer framing jumps instead of moving", () => {
      reduced = true;
      renderMap(sweep());
      lastMap().scale = 20;
      emit("load");
      expect(lastMap().fitBounds).toHaveBeenCalledTimes(2);
      expect(lastMap().fitBounds).toHaveBeenLastCalledWith(
        CREATURES_BOUNDS,
        expect.objectContaining({ padding: CREATURES_PADDING, animate: false }),
      );
    });

    it("an empty fence keeps the fence framing", () => {
      renderMap(sweep({ creatures: [] }));
      lastMap().scale = 20;
      emit("load");
      emit("moveend");
      playFrames();
      expect(lastMap().fitBounds).toHaveBeenCalledOnce();
    });

    // The wheel handler (and drag, pinch, keyboard) passes the DOM event along with the camera move
    it("a gesture during the sweep keeps the person's camera: it does not close in afterwards", () => {
      renderMap(sweep());
      emit("load");
      lastMap().scale = 20;
      emit("moveend");
      fireEvent.wheel(lastMap().container, { deltaX: 30, deltaMode: 0 });
      expect(lastMap().panBy).toHaveBeenCalledOnce();
      emit("movestart", { originalEvent: new WheelEvent("wheel") });
      playFrames();
      expect(liveMarkers()).toHaveLength(2);
      expect(lastMap().fitBounds).toHaveBeenCalledOnce();
    });

    it("the sweep's own camera moves do not count as a gesture", () => {
      renderMap(sweep());
      emit("load");
      lastMap().scale = 20;
      emit("movestart", {});
      emit("moveend");
      playFrames();
      expect(lastMap().fitBounds).toHaveBeenCalledTimes(2);
    });

    it("a gesture during a previous fence does not hold back the next one", () => {
      const { rerender } = renderMap(sweep());
      emit("load");
      emit("movestart", { originalEvent: new WheelEvent("wheel") });
      rerender(sweep({ fence: PAMPA }));
      lastMap().scale = 20;
      emit("moveend");
      playFrames();
      expect(lastMap().fitBounds).toHaveBeenCalledTimes(3);
    });
  });

  describe("with the entry flight", () => {
    function renderFlying(props: SweepProps) {
      const view = render(
        <BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} sweep={props} />,
      );
      const rerender = (next: SweepProps) =>
        view.rerender(
          <BaseMap habitats={habitats} labels={labels} padding={padding} intro onStatusChange={vi.fn()} sweep={next} />,
        );
      return { rerender };
    }

    // The flight lands with a jump to its final frame: left running, it would undo the fence's framing
    it("a fence chosen while flying ends the flight before framing it", () => {
      const { rerender } = renderFlying(sweep({ fence: null }));
      emit("load");
      expect(flight.cancel).not.toHaveBeenCalled();
      rerender(sweep());
      expect(flight.cancel).toHaveBeenCalledOnce();
      expect(lastMap().fitBounds).toHaveBeenCalledOnce();
      expect(flight.cancel.mock.invocationCallOrder[0]).toBeLessThan(lastMap().fitBounds.mock.invocationCallOrder[0]);
    });

    it("a creature opened while flying ends the flight before flying to it", () => {
      const { rerender } = renderFlying(sweep({ fence: null }));
      emit("load");
      rerender(sweep({ fence: null, focus: 7 }));
      expect(flight.cancel).toHaveBeenCalledOnce();
      expect(lastMap().flyTo).toHaveBeenCalledOnce();
      expect(flight.cancel.mock.invocationCallOrder[0]).toBeLessThan(lastMap().flyTo.mock.invocationCallOrder[0]);
    });

    it("without a fence or a creature the flight goes on", () => {
      const { rerender } = renderFlying(sweep({ fence: null }));
      emit("load");
      rerender(sweep({ fence: null, creatures: CREATURES.map((c) => ({ ...c })) }));
      expect(flight.cancel).not.toHaveBeenCalled();
    });
  });

});
