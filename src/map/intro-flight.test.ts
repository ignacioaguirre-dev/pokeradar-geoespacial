import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTRO_CENTER,
  INTRO_DURATION_MS,
  INTRO_PROJECTION,
  MAX_START_ZOOM,
  introProjection,
  introStartZoom,
  startIntroFlight,
  type IntroMap,
} from "./intro-flight";
import { MIN_ZOOM } from "./argentina";

const rim = vi.hoisted(() => ({ attached: 0, removed: 0, color: "" }));

vi.mock("./globe-rim", () => ({
  attachGlobeRim: (_map: unknown, color: string) => {
    rim.attached += 1;
    rim.color = color;
    return { remove: () => (rim.removed += 1) };
  },
}));

const RIM_COLOR = "#7c8a8e";

type Camera = { center: [number, number]; zoom: number };

// Stands in for MapLibre: the camera, the limits and the events the flight relies on
class FakeMap {
  camera: Camera = { center: [-63.5, -38.4], zoom: 3.2 };
  minZoom = MIN_ZOOM;
  maxBounds: unknown = [[-125, -70], [0, 5]];
  projection: unknown = INTRO_PROJECTION;
  styleLoaded = false;
  isLoaded = false;
  container = new EventTarget();
  canvas = { style: { visibility: "" } };
  handlers = new Map<string, Set<() => void>>();
  easing: { center: unknown; zoom: number; duration: number } | null = null;
  stopped = 0;

  getCenter() {
    const [lng, lat] = this.camera.center;
    return { lng, lat, toArray: () => [lng, lat] as [number, number] };
  }
  getZoom() {
    return this.camera.zoom;
  }
  getMinZoom() {
    return this.minZoom;
  }
  getMaxBounds() {
    return this.maxBounds;
  }
  setMinZoom(zoom: number) {
    this.minZoom = zoom;
  }
  setMaxBounds(bounds: unknown) {
    this.maxBounds = bounds;
  }
  setProjection(projection: unknown) {
    // MapLibre throws until the style is parsed
    if (!this.styleLoaded) throw new Error("Style is not done loading.");
    this.projection = projection;
  }
  jumpTo({ center, zoom }: { center: [number, number] | { lng: number; lat: number }; zoom: number }) {
    const pair: [number, number] = Array.isArray(center) ? center : [center.lng, center.lat];
    this.camera = { center: pair, zoom };
    this.emit("moveend");
  }
  easeTo(options: { center: unknown; zoom: number; duration: number }) {
    this.easing = options;
  }
  stop() {
    this.stopped += 1;
  }
  loaded() {
    return this.isLoaded;
  }
  getCanvas() {
    return this.canvas as unknown as HTMLCanvasElement;
  }
  getContainer() {
    return this.container as unknown as HTMLElement;
  }
  on(type: string, handler: () => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)?.add(handler);
  }
  off(type: string, handler: () => void) {
    this.handlers.get(type)?.delete(handler);
  }
  emit(type: string) {
    if (type === "style.load") this.styleLoaded = true;
    if (type === "load") this.isLoaded = true;
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler();
  }
  // Ends the running animation the way MapLibre does
  arrive() {
    if (!this.easing) throw new Error("not flying");
    const { center, zoom } = this.easing as { center: { lng: number; lat: number }; zoom: number };
    this.easing = null;
    this.camera = { center: [center.lng, center.lat], zoom };
    this.emit("moveend");
  }
}

const SIZE = { width: 390, height: 844 };
const FINAL: Camera = { center: [-63.5, -38.4], zoom: 3.2 };

describe("introStartZoom", () => {
  it("frames the globe on a phone below the projection morph", () => {
    const zoom = introStartZoom(390, 844);
    expect(zoom).toBeGreaterThanOrEqual(0);
    expect(zoom).toBeLessThanOrEqual(MAX_START_ZOOM);
  });

  it("never starts closer than a whole sphere, even on a large screen", () => {
    expect(introStartZoom(1920, 1080)).toBe(MAX_START_ZOOM);
  });

  it("never goes below zoom 0 on a tiny screen", () => {
    expect(introStartZoom(100, 80)).toBe(0);
  });
});

describe("introProjection", () => {
  function stops(finalZoom: number) {
    const [kind, , input, globeUntil, globe, flatFrom, flat] = introProjection(finalZoom).type as unknown[];
    expect([kind, input, globe, flat]).toEqual(["interpolate", ["zoom"], "vertical-perspective", "mercator"]);
    return { globeUntil: globeUntil as number, flatFrom: flatFrom as number };
  }

  // Late in the descent, so the far side of the world the morph drags along is already off screen
  it.each([2, 2.6, 3.3, 3.9])("morphs to flat just before a final zoom of %s", (finalZoom) => {
    const { globeUntil, flatFrom } = stops(finalZoom);
    expect(flatFrom).toBeLessThan(finalZoom);
    expect(flatFrom).toBeGreaterThan(finalZoom - 0.25);
    expect(flatFrom - globeUntil).toBeCloseTo(0.3, 6);
  });

  // The landing is then plain mercator, and the opening view is still a whole globe
  it("always starts above the opening zoom and ends below the lowest final one", () => {
    const { globeUntil, flatFrom } = stops(MIN_ZOOM);
    expect(globeUntil).toBeGreaterThan(MAX_START_ZOOM);
    expect(flatFrom).toBeLessThan(MIN_ZOOM);
  });

  it("is what the style starts with, until the final frame is known", () => {
    expect(INTRO_PROJECTION).toEqual(introProjection(MIN_ZOOM));
  });
});

describe("startIntroFlight", () => {
  let map: FakeMap;
  let onEnd: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    map = new FakeMap();
    onEnd = vi.fn<() => void>();
    rim.attached = 0;
    rim.removed = 0;
    rim.color = "";
  });

  function start() {
    return startIntroFlight(map as unknown as IntroMap, { ...SIZE, rimColor: RIM_COLOR, onEnd });
  }

  it("starts from the globe with South America in view, without the limits", () => {
    start();
    expect(map.camera).toEqual({ center: INTRO_CENTER, zoom: introStartZoom(SIZE.width, SIZE.height) });
    expect(map.maxBounds).toBeNull();
    expect(map.minZoom).toBeLessThanOrEqual(map.camera.zoom);
    expect(onEnd).not.toHaveBeenCalled();
  });

  // Before its tiles arrive the globe is a bare disk of the land color, not the Earth
  it("hides the globe until its tiles load", () => {
    start();
    map.emit("style.load");
    expect(map.canvas.style.visibility).toBe("hidden");
    map.emit("load");
    expect(map.canvas.style.visibility).toBe("");
  });

  it("shows the map at once when the flight is skipped before load", () => {
    const flight = start();
    flight.cancel();
    expect(map.canvas.style.visibility).toBe("");
  });

  it("morphs over this screen's own range, set before the globe shows", () => {
    start();
    map.emit("style.load");
    expect(map.projection).toEqual(introProjection(FINAL.zoom));
  });

  it("draws the globe's rim from load until the flight ends", () => {
    const flight = start();
    map.emit("style.load");
    expect(rim.attached).toBe(0);
    map.emit("load");
    expect(rim).toMatchObject({ attached: 1, removed: 0, color: RIM_COLOR });
    flight.cancel();
    expect(rim.removed).toBe(1);
  });

  it("removes the rim when the map goes away mid-flight", () => {
    const flight = start();
    map.emit("style.load");
    map.emit("load");
    flight.dispose();
    expect(rim.removed).toBe(1);
  });

  it("waits for the map to load before flying", () => {
    start();
    map.emit("style.load");
    expect(map.easing).toBeNull();
    map.emit("load");
    expect(map.easing).toMatchObject({ zoom: FINAL.zoom, duration: INTRO_DURATION_MS });
    expect(map.easing?.center).toMatchObject({ lng: FINAL.center[0], lat: FINAL.center[1] });
  });

  it("flies at once when the map already loaded", () => {
    map.styleLoaded = true;
    map.isLoaded = true;
    start();
    expect(map.easing).toMatchObject({ zoom: FINAL.zoom });
  });

  it("ends on the Argentina frame, flat and with the limits back", () => {
    start();
    map.emit("style.load");
    map.emit("load");
    map.arrive();
    expect(map.camera).toEqual(FINAL);
    expect(map.projection).toEqual({ type: "mercator" });
    expect(map.maxBounds).toEqual([[-125, -70], [0, 5]]);
    expect(map.minZoom).toBe(MIN_ZOOM);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("cancel jumps to the final frame and applies the limits", () => {
    const flight = start();
    map.emit("style.load");
    map.emit("load");
    flight.cancel();
    expect(map.stopped).toBeGreaterThan(0);
    expect(map.camera).toEqual(FINAL);
    expect(map.projection).toEqual({ type: "mercator" });
    expect(map.maxBounds).toEqual([[-125, -70], [0, 5]]);
    expect(map.minZoom).toBe(MIN_ZOOM);
    expect(onEnd).toHaveBeenCalledOnce();
    // A late arrival or a second cancel changes nothing
    flight.cancel();
    map.emit("moveend");
    expect(onEnd).toHaveBeenCalledOnce();
  });

  // Skipping while the style is still downloading: the projection can only change once it is parsed
  it("cancel before the style loads flattens the map as soon as it does", () => {
    const flight = start();
    flight.cancel();
    expect(map.camera).toEqual(FINAL);
    expect(onEnd).toHaveBeenCalledOnce();
    map.emit("style.load");
    expect(map.projection).toEqual({ type: "mercator" });
    map.emit("load");
    expect(map.easing).toBeNull();
  });

  it.each(["mousedown", "touchstart", "wheel", "keydown"])("a %s on the map cancels the flight", (type) => {
    start();
    map.emit("style.load");
    map.emit("load");
    map.container.dispatchEvent(new Event(type));
    expect(map.camera).toEqual(FINAL);
    expect(map.maxBounds).toEqual([[-125, -70], [0, 5]]);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("an interaction before load also cancels", () => {
    start();
    map.container.dispatchEvent(new Event("wheel"));
    expect(map.camera).toEqual(FINAL);
    map.emit("load");
    expect(map.easing).toBeNull();
  });

  it("dispose detaches without touching the map", () => {
    const flight = start();
    flight.dispose();
    const camera = map.camera;
    map.container.dispatchEvent(new Event("mousedown"));
    map.emit("load");
    expect(map.camera).toBe(camera);
    expect(map.easing).toBeNull();
    expect(onEnd).not.toHaveBeenCalled();
  });
});
