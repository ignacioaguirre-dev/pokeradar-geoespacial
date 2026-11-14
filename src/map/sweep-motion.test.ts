import { describe, expect, it } from "vitest";
import {
  cubicBezier,
  parseCurve,
  RING_FRACTIONS,
  RING_OPACITY,
  ringRadius,
  sweepFrame,
  sweepLength,
  traceGradient,
  worldRadius,
} from "./sweep-motion";

const linear = (t: number) => t;
// Not the real token: tooling/tokens.test.ts keeps its numbers in one module only
const OUT = [0.2, 0.9, 0.3, 1] as const;

describe("parseCurve", () => {
  it("reads a cubic-bezier token", () => {
    expect(parseCurve("cubic-bezier(0.2, 0.9, 0.3, 1)")).toEqual([0.2, 0.9, 0.3, 1]);
    expect(parseCurve(" cubic-bezier(.5,0,.5,1) ")).toEqual([0.5, 0, 0.5, 1]);
  });

  it("gives null for anything else", () => {
    expect(parseCurve("")).toBeNull();
    expect(parseCurve("ease-out")).toBeNull();
    expect(parseCurve("cubic-bezier(1, 2)")).toBeNull();
  });
});

describe("cubicBezier", () => {
  it("starts at 0, ends at 1 and is the identity for a straight curve", () => {
    const ease = cubicBezier(OUT);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(cubicBezier([1 / 3, 1 / 3, 2 / 3, 2 / 3])(0.3)).toBeCloseTo(0.3, 4);
  });

  it("an out curve runs ahead early, like the CSS one", () => {
    const ease = cubicBezier(OUT);
    // Reference: x(t) = 0.25 solved by bisection, then y(t)
    expect(ease(0.25)).toBeCloseTo(0.7611, 3);
    expect(ease(0.5)).toBeGreaterThan(0.9);
  });

  it("clamps outside 0–1", () => {
    const ease = cubicBezier(OUT);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe("sweepFrame", () => {
  const D = 900;

  it("starts with every ring at the center and no trace drawn", () => {
    const frame = sweepFrame(0, D, linear);
    expect(frame.rings.map((r) => r.scale)).toEqual([0, 0, 0]);
    expect(frame.trace).toBe(0);
    expect(frame.done).toBe(false);
  });

  it("rings leave one after the other", () => {
    const frame = sweepFrame(D / 4, D, linear);
    expect(frame.rings[0].scale).toBeGreaterThan(frame.rings[1].scale);
    expect(frame.rings[1].scale).toBeGreaterThan(frame.rings[2].scale);
  });

  it("ends with each ring at its final size and opacity and the traces complete", () => {
    const frame = sweepFrame(sweepLength(D), D, linear);
    expect(frame.rings.map((r) => r.scale)).toEqual([...RING_FRACTIONS]);
    expect(frame.rings.map((r) => r.opacity)).toEqual([...RING_OPACITY]);
    expect(frame.trace).toBe(1);
    expect(frame.done).toBe(true);
  });

  // Reduced motion zeroes the token: the first frame is already the last
  it("with no duration the first frame is the final one", () => {
    expect(sweepFrame(0, 0, linear)).toEqual(sweepFrame(sweepLength(D), D, linear));
  });

  // WCAG 2.2.2: motion that stops within 5 s needs no pause control
  it("lasts well under five seconds", () => {
    expect(sweepLength(D)).toBeLessThan(5000);
  });
});

describe("worldRadius", () => {
  it("is the farthest vertex from the center, in zoom-0 pixels", () => {
    // 512 px span 360° at zoom 0, so 1° of longitude at the equator is 512 / 360 px
    expect(
      worldRadius(
        [0, 0],
        [
          [1, 0],
          [0, 0.5],
          [-0.5, 0],
        ],
      ),
    ).toBeCloseTo(512 / 360, 4);
  });

  it("grows toward the poles like the Mercator map", () => {
    const ring = [[1, -45] as const, [-1, -45] as const];
    expect(worldRadius([0, -45], ring)).toBeCloseTo(512 / 360, 4);
    const north = [[0, -44] as const];
    expect(worldRadius([0, -45], north)).toBeGreaterThan(512 / 360);
  });
});

describe("ringRadius", () => {
  // Anchored to the ground: the radius doubles with every zoom level
  it("scales with the zoom so a ring keeps its size on the ground", () => {
    expect(ringRadius(10, 0.5)).toEqual(["interpolate", ["exponential", 2], ["zoom"], 0, 5, 24, 5 * 2 ** 24]);
  });
});

describe("traceGradient", () => {
  it("draws nothing before the trace starts", () => {
    expect(traceGradient("#d9a55b", 0)).toEqual([
      "interpolate",
      ["linear"],
      ["line-progress"],
      0,
      "#d9a55b00",
      1,
      "#d9a55b00",
    ]);
  });

  it("brightens toward the head and leaves the rest of the path clear", () => {
    const gradient = traceGradient("#d9a55b", 0.5);
    expect(gradient.slice(3)).toEqual([0, "#d9a55b66", 0.5, "#d9a55b", expect.closeTo(0.5, 2), "#d9a55b00"]);
    const stops = gradient.slice(3).filter((_, i) => i % 2 === 0) as number[];
    expect(stops).toEqual([...stops].sort((a, b) => a - b));
    expect(new Set(stops).size).toBe(stops.length);
  });

  it("is the whole trace once complete", () => {
    expect(traceGradient("#d9a55b", 1).slice(3)).toEqual([0, "#d9a55b66", 1, "#d9a55b"]);
  });
});
