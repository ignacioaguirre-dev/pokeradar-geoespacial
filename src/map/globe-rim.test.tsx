import { describe, expect, it } from "vitest";
import { attachGlobeRim, RIM_LAYER, rimOpacity, rimPath, type RimMap, type RimProjection } from "./globe-rim";

// Column-major, as MapLibre stores them. The path rounds to hundredths of a pixel, hence precision 1 below
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function points(path: string): [number, number][] {
  return [...path.matchAll(/[ML] ?(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

// An orthographic view down the z axis: the silhouette is the unit circle, and clip space is the sphere's x and y
const GLOBE: RimProjection = {
  mainMatrix: IDENTITY,
  fallbackMatrix: IDENTITY,
  clippingPlane: [0, 0, 1, 0],
  projectionTransition: 1,
};

describe("rimPath", () => {
  it("traces the globe's silhouette on screen", () => {
    const path = rimPath(GLOBE, 0.5, 200, 200);
    expect(path).toMatch(/^M .* Z$/);
    const ring = points(path);
    expect(ring.length).toBeGreaterThan(32);
    for (const [x, y] of ring) expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(100, 1);
  });

  // The silhouette of a sphere seen from close is a smaller circle, nearer the camera
  it("follows a tangent plane nearer the camera", () => {
    const ring = points(rimPath({ ...GLOBE, clippingPlane: [0, 0, 1, -0.6] }, 0.5, 200, 200));
    for (const [x, y] of ring) expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(80, 1);
  });

  // Mid-morph, MapLibre mixes the globe and flat positions in clip space; the rim must follow the same mix
  it("mixes with the flat position during the morph", () => {
    // Flat clip space = mercator x, y as given: (0.5, 0.5) is the screen's top right corner
    const flat = { ...GLOBE, projectionTransition: 0 };
    const globe = points(rimPath(GLOBE, 0.5, 200, 200));
    const plain = points(rimPath(flat, 0.5, 200, 200));
    const half = points(rimPath({ ...GLOBE, projectionTransition: 0.5 }, 0.5, 200, 200));
    half.forEach(([x, y], i) => {
      expect(x).toBeCloseTo((globe[i][0] + plain[i][0])  / 2, 1);
      expect(y).toBeCloseTo((globe[i][1] + plain[i][1])  / 2, 1);
    });
  });

  // The flat world repeats; the rim takes the copy under the camera, not one a world away
  it("takes the world copy nearest the center", () => {
    const flat = { ...GLOBE, projectionTransition: 0 };
    for (const [x] of points(rimPath(flat, 0.9, 200, 200))) {
      // Mercator x within half a world of 0.9, scaled to clip space (x) and then to pixels
      expect((x / 200) * 2 - 1).toBeGreaterThan(0.4 - 1e-9);
      expect((x / 200) * 2 - 1).toBeLessThanOrEqual(1.4 + 1e-9);
    }
  });
});

describe("rimOpacity", () => {
  it("is full on the globe and fades out over the first half of the morph", () => {
    expect(rimOpacity(1)).toBe(1);
    expect(rimOpacity(0.75)).toBeCloseTo(0.5, 6);
    expect(rimOpacity(0.5)).toBe(0);
    expect(rimOpacity(0)).toBe(0);
  });
});

type Layer = { id: string; render(gl: unknown, options: { defaultProjectionData: RimProjection }): void };

// Calls the custom layer the way MapLibre does on every frame
class FakeMap {
  container = document.createElement("div");
  canvas = { clientWidth: 200, clientHeight: 200 };
  layers = new Map<string, Layer>();
  projection: RimProjection = GLOBE;
  getCanvasContainer() {
    return this.container;
  }
  getCanvas() {
    return this.canvas as unknown as HTMLCanvasElement;
  }
  getCenter() {
    return { lng: 0, lat: 0 };
  }
  addLayer(layer: Layer) {
    this.layers.set(layer.id, layer);
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
  }
  frame() {
    for (const layer of this.layers.values()) layer.render(null, { defaultProjectionData: this.projection });
  }
}

describe("attachGlobeRim", () => {
  function attach(map: FakeMap) {
    return attachGlobeRim(map as unknown as RimMap, "#7c8a8e");
  }

  it("draws a thin line in the given color, hidden from assistive tech and the pointer", () => {
    const map = new FakeMap();
    attach(map);
    map.frame();
    const svg = map.container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.style.pointerEvents).toBe("none");
    const path = svg?.querySelector("path");
    expect(path).toHaveAttribute("stroke", "#7c8a8e");
    expect(path).toHaveAttribute("stroke-width", "1");
    expect(path).toHaveAttribute("fill", "none");
    expect(path?.getAttribute("d")).toMatch(/^M /);
  });

  it("follows the camera on every frame and fades with the morph", () => {
    const map = new FakeMap();
    attach(map);
    map.frame();
    const svg = map.container.querySelector("svg");
    const before = svg?.querySelector("path")?.getAttribute("d");
    map.projection = { ...GLOBE, clippingPlane: [0, 0, 1, -0.6], projectionTransition: 0.75 };
    map.frame();
    expect(svg?.querySelector("path")?.getAttribute("d")).not.toBe(before);
    expect(Number(svg?.style.opacity)).toBeCloseTo(0.5, 6);
    map.projection = { ...GLOBE, projectionTransition: 0 };
    map.frame();
    expect(svg?.style.display).toBe("none");
  });

  it("remove takes the line away and stops following the camera", () => {
    const map = new FakeMap();
    const rim = attach(map);
    expect(map.getLayer(RIM_LAYER)).toBeDefined();
    rim.remove();
    expect(map.container.querySelector("svg")).toBeNull();
    expect(map.getLayer(RIM_LAYER)).toBeUndefined();
  });
});
