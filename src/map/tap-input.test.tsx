import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listenForTaps, TAP_MAX_MS, TAP_MAX_PX } from "./tap-input";

let container: HTMLDivElement;
let canvas: HTMLCanvasElement;
let onTap: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
let stop: () => void;

type Init = { x: number; y: number; t: number; id?: number; type?: string; button?: number };

// jsdom has no PointerEvent constructor with coordinates: a MouseEvent carries them, the rest is set on it
function pointer(type: string, target: EventTarget, { x, y, t, id = 1, type: kind = "touch", button = 0 }: Init) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button });
  Object.defineProperties(event, {
    pointerId: { value: id },
    pointerType: { value: kind },
    timeStamp: { value: t },
  });
  target.dispatchEvent(event);
}

function tap(target: EventTarget, from: Init, to: Partial<Init> = {}) {
  pointer("pointerdown", target, from);
  pointer("pointerup", target, { ...from, t: from.t + 100, ...to });
}

beforeEach(() => {
  container = document.createElement("div");
  canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
  onTap = vi.fn();
  stop = listenForTaps(container, canvas, onTap);
});

afterEach(() => {
  stop();
  container.remove();
});

describe("listenForTaps", () => {
  it("reports a tap in canvas pixels", () => {
    tap(canvas, { x: 110, y: 220, t: 0 });
    expect(onTap).toHaveBeenCalledWith(100, 200);
  });

  it("a small wobble is still a tap", () => {
    tap(canvas, { x: 100, y: 100, t: 0 }, { x: 100 + TAP_MAX_PX - 1, y: 100 });
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("a drag moves the map instead", () => {
    tap(canvas, { x: 100, y: 100, t: 0 }, { x: 100 + TAP_MAX_PX + 1, y: 100 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("a long press is not a tap", () => {
    tap(canvas, { x: 100, y: 100, t: 0 }, { t: TAP_MAX_MS + 1 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("a pinch is not a tap, for either finger", () => {
    pointer("pointerdown", canvas, { x: 100, y: 100, t: 0, id: 1 });
    pointer("pointerdown", canvas, { x: 200, y: 200, t: 10, id: 2 });
    pointer("pointerup", canvas, { x: 100, y: 100, t: 100, id: 1 });
    pointer("pointerup", canvas, { x: 200, y: 200, t: 110, id: 2 });
    expect(onTap).not.toHaveBeenCalled();
    // And the next lone finger taps again
    tap(canvas, { x: 100, y: 100, t: 500 });
    expect(onTap).toHaveBeenCalledOnce();
  });

  // A marker is a button of its own: it opens its creature
  it("ignores presses on anything but the canvas", () => {
    const marker = document.createElement("button");
    container.appendChild(marker);
    tap(marker, { x: 100, y: 100, t: 0 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("ignores the mouse's other buttons", () => {
    tap(canvas, { x: 100, y: 100, t: 0, type: "mouse", button: 2 });
    expect(onTap).not.toHaveBeenCalled();
    tap(canvas, { x: 100, y: 100, t: 200, type: "mouse" });
    expect(onTap).toHaveBeenCalledOnce();
  });

  // Released over a panel, the press must not linger and turn the next tap into a pinch
  it("hears a release outside the map", () => {
    pointer("pointerdown", canvas, { x: 100, y: 100, t: 0 });
    pointer("pointerup", document.body, { x: 400, y: 400, t: 100 });
    tap(canvas, { x: 100, y: 100, t: 500 });
    expect(onTap).toHaveBeenCalledOnce();
  });

  it("a cancelled press is forgotten", () => {
    pointer("pointerdown", canvas, { x: 100, y: 100, t: 0 });
    pointer("pointercancel", canvas, { x: 100, y: 100, t: 50 });
    pointer("pointerup", canvas, { x: 100, y: 100, t: 60 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it("stops listening", () => {
    stop();
    tap(canvas, { x: 100, y: 100, t: 0 });
    expect(onTap).not.toHaveBeenCalled();
  });
});
