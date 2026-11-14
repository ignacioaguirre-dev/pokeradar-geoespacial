import { describe, expect, it } from "vitest";
import {
  type GestureState,
  type WheelSample,
  classifyWheel,
  GESTURE_GAP_MS,
  toPixels,
  wheelAction,
  wheelZoomDelta,
} from "./wheel-gesture";

const PIXELS = 0;
const LINES = 1;
const PAGES = 2;

// Chrome and Safari on macOS send mouse wheel steps in multiples of this; MapLibre reads it as a mouse
const MAC_STEP = 4.000244140625;

function sample(overrides: Partial<WheelSample> = {}): WheelSample {
  return { deltaX: 0, deltaY: 0, deltaMode: PIXELS, ctrlKey: false, ...overrides };
}

describe("classifyWheel", () => {
  describe("first event of a gesture", () => {
    it.each([
      ["a horizontal delta", sample({ deltaX: 12, deltaY: 0 })],
      ["a horizontal delta on a round vertical one", sample({ deltaX: 3, deltaY: 100 })],
      ["a fractional vertical delta", sample({ deltaY: 4.5 })],
      ["a small vertical delta in pixels", sample({ deltaY: -49 })],
    ])("reads %s as touchpad", (_, event) => {
      expect(classifyWheel(event, null, 0).kind).toBe("touchpad");
    });

    it.each([
      ["a line delta (Firefox)", sample({ deltaY: 3, deltaMode: LINES })],
      ["a multiple of 100", sample({ deltaY: 200 })],
      ["a multiple of 120", sample({ deltaY: -120 })],
      ["an ambiguous large delta", sample({ deltaY: 75 })],
      ["a delta of exactly 50", sample({ deltaY: 50 })],
      // Windows with a non-integer display scale sends mouse ticks like these
      ["a fractional tick of 100 or more (166.67)", sample({ deltaY: 166.67 })],
      ["a scaled tick of 125", sample({ deltaY: -125 })],
      // 4.0002, 8.0005 and 12.0007 have decimals and are under 50, so without this rule they read as touchpad
      ["a macOS wheel step of 4.0002", sample({ deltaY: MAC_STEP })],
      ["a macOS wheel step of 8.0005", sample({ deltaY: -2 * MAC_STEP })],
      ["a macOS wheel step of 12.0007", sample({ deltaY: 3 * MAC_STEP })],
    ])("reads %s as mouse", (_, event) => {
      expect(classifyWheel(event, null, 0).kind).toBe("mouse");
    });

    it.each([
      ["4.0001, close to a macOS step but not one", sample({ deltaY: 4.0001 })],
      ["a plain 4", sample({ deltaY: 4 })],
      ["a macOS step with a horizontal delta", sample({ deltaX: 1, deltaY: MAC_STEP })],
    ])("still reads %s as touchpad", (_, event) => {
      expect(classifyWheel(event, null, 0).kind).toBe("touchpad");
    });

    it("reads a macOS step in lines as mouse by its mode, not its size", () => {
      expect(classifyWheel(sample({ deltaY: MAC_STEP, deltaMode: LINES }), null, 0).kind).toBe("mouse");
    });

    it("starts the gesture at the event", () => {
      expect(classifyWheel(sample({ deltaY: 100 }), null, 1000)).toEqual({ kind: "mouse", startedAt: 1000, lastAt: 1000 });
    });
  });

  it("corrects an ambiguous start to touchpad within the gesture", () => {
    const first = classifyWheel(sample({ deltaY: 100 }), null, 0);
    const second = classifyWheel(sample({ deltaY: 7.25 }), first, 16);
    expect(second).toEqual({ kind: "touchpad", startedAt: 0, lastAt: 16 });
  });

  it("never turns a touchpad gesture into mouse", () => {
    const first = classifyWheel(sample({ deltaX: 5 }), null, 0);
    const second = classifyWheel(sample({ deltaY: 120 }), first, 30);
    const third = classifyWheel(sample({ deltaY: 3, deltaMode: LINES }), second, 60);
    expect(third).toEqual({ kind: "touchpad", startedAt: 0, lastAt: 60 });
  });

  it("keeps a mouse gesture going while ticks keep coming", () => {
    let state: GestureState | null = null;
    for (let at = 0; at <= 500; at += 100) state = classifyWheel(sample({ deltaY: 100 }), state, at);
    expect(state).toEqual({ kind: "mouse", startedAt: 0, lastAt: 500 });
  });

  it("classifies again after a pause", () => {
    const touchpad = classifyWheel(sample({ deltaX: 5 }), null, 0);
    const next = classifyWheel(sample({ deltaY: 100 }), touchpad, GESTURE_GAP_MS);
    expect(next).toEqual({ kind: "mouse", startedAt: GESTURE_GAP_MS, lastAt: GESTURE_GAP_MS });
  });

  it("does not let ctrlKey change the classification", () => {
    for (const event of [sample({ deltaY: 100 }), sample({ deltaY: 2.5 }), sample({ deltaX: 4 })]) {
      expect(classifyWheel({ ...event, ctrlKey: true }, null, 0)).toEqual(classifyWheel(event, null, 0));
    }
  });
});

describe("wheelAction", () => {
  const mouse: GestureState = { kind: "mouse", startedAt: 0, lastAt: 0 };
  const touchpad: GestureState = { kind: "touchpad", startedAt: 0, lastAt: 0 };

  it("zooms with ctrlKey whatever the classification", () => {
    expect(wheelAction(sample({ ctrlKey: true }), touchpad)).toBe("zoom");
    expect(wheelAction(sample({ ctrlKey: true }), mouse)).toBe("zoom");
  });

  it("pans a touchpad gesture and zooms a mouse one", () => {
    expect(wheelAction(sample(), touchpad)).toBe("pan");
    expect(wheelAction(sample(), mouse)).toBe("zoom");
  });
});

describe("toPixels", () => {
  it("keeps pixels, and scales lines and pages", () => {
    expect(toPixels(sample({ deltaX: 3, deltaY: -7 }), 800)).toEqual([3, -7]);
    expect(toPixels(sample({ deltaX: 1, deltaY: -2, deltaMode: LINES }), 800)).toEqual([40, -80]);
    expect(toPixels(sample({ deltaY: 1, deltaMode: PAGES }), 800)).toEqual([0, 800]);
  });
});

describe("wheelZoomDelta", () => {
  it("zooms in when scrolling up and out when scrolling down, symmetrically", () => {
    const zoomIn = wheelZoomDelta(sample({ deltaY: -100 }), 800);
    expect(zoomIn).toBeGreaterThan(0);
    expect(wheelZoomDelta(sample({ deltaY: 100 }), 800)).toBeCloseTo(-zoomIn);
  });

  it("matches MapLibre's step for a mouse tick", () => {
    // MapLibre: scale = 2 / (1 + e^(-|delta| / 450)), zoom += log2(scale)
    expect(wheelZoomDelta(sample({ deltaY: -100 }), 800)).toBeCloseTo(Math.log2(2 / (1 + Math.exp(-100 / 450))));
  });

  it("uses MapLibre's finer rate for pinches and small steps", () => {
    expect(wheelZoomDelta(sample({ deltaY: -3, ctrlKey: true }), 800)).toBeCloseTo(Math.log2(2 / (1 + Math.exp(-3 / 100))));
  });

  it("uses the mouse rate for a fractional tick of 100 or more", () => {
    expect(wheelZoomDelta(sample({ deltaY: -166.67 }), 800)).toBeCloseTo(Math.log2(2 / (1 + Math.exp(-166.67 / 450))));
  });

  // MapLibre switches to the coarse wheel rate only for steps larger than a single macOS tick
  it("uses MapLibre's finer rate for a single macOS wheel step", () => {
    expect(wheelZoomDelta(sample({ deltaY: -MAC_STEP }), 800)).toBeCloseTo(
      Math.log2(2 / (1 + Math.exp(-MAC_STEP / 100))),
    );
  });

  it.each([2, 3])("uses the mouse rate for a macOS step of %i ticks", (ticks) => {
    expect(wheelZoomDelta(sample({ deltaY: -ticks * MAC_STEP }), 800)).toBeCloseTo(
      Math.log2(2 / (1 + Math.exp((-ticks * MAC_STEP) / 450))),
    );
  });

  it("does not zoom without a vertical delta", () => {
    expect(wheelZoomDelta(sample({ deltaX: 50 }), 800)).toBe(0);
  });

  it("converts line deltas before zooming", () => {
    expect(wheelZoomDelta(sample({ deltaY: -3, deltaMode: LINES }), 800)).toBeCloseTo(
      wheelZoomDelta(sample({ deltaY: -120 }), 800),
    );
  });
});
