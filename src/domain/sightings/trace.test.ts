import { describe, expect, test } from "vitest";
import type { LngLat } from "@/domain/geometry/types";
import { TRACE_SAMPLES, trace } from "./trace";

const FROM: LngLat = [-57.3, -28.9];
const TO: LngLat = [-56.8, -28.1];

// Signed distance of p from the line a→b: positive on the left
function side([ax, ay]: LngLat, [bx, by]: LngLat, [px, py]: LngLat): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

describe("trace", () => {
  test("starts exactly at the origin and ends exactly at the creature", () => {
    const points = trace(FROM, TO);
    expect(points[0]).toEqual(FROM);
    expect(points.at(-1)).toEqual(TO);
  });

  test("has one point per sample plus the start", () => {
    expect(trace(FROM, TO)).toHaveLength(TRACE_SAMPLES + 1);
    expect(trace(FROM, TO, 4)).toHaveLength(5);
  });

  test("is deterministic", () => {
    expect(trace(FROM, TO)).toEqual(trace(FROM, TO));
  });

  // Like tracks in a bubble chamber: every trace of a sweep curls the same way
  test("bends to the same side whatever the direction", () => {
    for (const to of [TO, [-58, -29.5], [-57.3, -27], [-55, -28.9]] as LngLat[]) {
      const middle = trace(FROM, to)[TRACE_SAMPLES / 2];
      expect(side(FROM, to, middle), `${to}`).toBeLessThan(0);
    }
  });

  test("bends in proportion to the distance, never crossing far from the chord", () => {
    const points = trace(FROM, TO);
    const chord = Math.hypot(TO[0] - FROM[0], TO[1] - FROM[1]);
    const offsets = points.map((p) => Math.abs(side(FROM, TO, p)) / chord);
    expect(Math.max(...offsets)).toBeGreaterThan(0.05 * chord);
    expect(Math.max(...offsets)).toBeLessThan(0.25 * chord);
  });

  test("a creature at the origin gives a trace that stays there", () => {
    expect(trace(FROM, FROM, 3)).toEqual([FROM, FROM, FROM, FROM]);
  });

  test("rejects fewer than one sample", () => {
    expect(() => trace(FROM, TO, 0)).toThrow(RangeError);
  });
});
