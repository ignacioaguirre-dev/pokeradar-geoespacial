// Tells a precision touchpad from a mouse wheel: both arrive as `wheel` events, but a touchpad
// should pan with two fingers and zoom only on a pinch (which browsers send with ctrlKey)

export type WheelSample = { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean };

export type GestureKind = "touchpad" | "mouse";

export type GestureState = { kind: GestureKind; startedAt: number; lastAt: number };

// Events closer than this belong to the same gesture; mouse ticks and touchpad frames both come faster
export const GESTURE_GAP_MS = 150;

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
// The pixels MapLibre's scroll zoom counts per line
const LINE_HEIGHT = 40;
// MapLibre's scroll zoom rates: fine for touchpads and pinches, coarse for mouse ticks
const FINE_ZOOM_RATE = 1 / 100;
const COARSE_ZOOM_RATE = 1 / 450;
const MAX_SCALE_PER_EVENT = 2;
const SMALL_DELTA = 50;
// Mouse ticks are 100 or 120 px, or 125 and 166.67 on Windows with a non-integer display scale
const MOUSE_TICK = 100;
// Chrome and Safari on macOS send mouse wheel steps in multiples of this; MapLibre's scroll zoom reads it as a mouse
const MAC_WHEEL_STEP = 4.000244140625;
// Float noise only: a touchpad delta landing this close to a multiple is not expected
const MAC_STEP_TOLERANCE = 1e-6;

function isMouseTick(deltaY: number): boolean {
  return Math.abs(deltaY) >= MOUSE_TICK;
}

function isMacWheelStep(event: WheelSample): boolean {
  if (event.deltaMode !== DOM_DELTA_PIXEL || event.deltaX !== 0 || event.deltaY === 0) return false;
  const steps = Math.abs(event.deltaY) / MAC_WHEEL_STEP;
  return Math.round(steps) >= 1 && Math.abs(steps - Math.round(steps)) < MAC_STEP_TOLERANCE;
}

function isTouchpadDeltaY(deltaY: number): boolean {
  if (isMouseTick(deltaY)) return false;
  return !Number.isInteger(deltaY) || (deltaY !== 0 && Math.abs(deltaY) < SMALL_DELTA);
}

function evidence(event: WheelSample): GestureKind | null {
  if (event.deltaMode === DOM_DELTA_LINE) return "mouse";
  if (event.deltaX !== 0) return "touchpad";
  if (isMouseTick(event.deltaY)) return "mouse";
  // Before the decimals rule: 4.0002, 8.0005 and 12.0007 have decimals but come from a mouse
  if (isMacWheelStep(event)) return "mouse";
  if (isTouchpadDeltaY(event.deltaY)) return "touchpad";
  return null;
}

export function classifyWheel(event: WheelSample, previous: GestureState | null, now: number): GestureState {
  const found = evidence(event);
  if (previous && now - previous.lastAt < GESTURE_GAP_MS) {
    // A gesture only ever upgrades to touchpad: one stray round delta must not turn a pan into a zoom
    const kind = previous.kind === "touchpad" || found === "touchpad" ? "touchpad" : "mouse";
    return { kind, startedAt: previous.startedAt, lastAt: now };
  }
  // Ambiguous starts are mouse, the map convention
  return { kind: found === "touchpad" ? "touchpad" : "mouse", startedAt: now, lastAt: now };
}

export function wheelAction(event: WheelSample, state: GestureState): "zoom" | "pan" {
  return event.ctrlKey || state.kind === "mouse" ? "zoom" : "pan";
}

export function toPixels(event: WheelSample, pageHeight: number): [number, number] {
  const factor =
    event.deltaMode === DOM_DELTA_LINE ? LINE_HEIGHT : event.deltaMode === DOM_DELTA_PAGE ? pageHeight : 1;
  return [event.deltaX * factor, event.deltaY * factor];
}

// MapLibre's scroll zoom curve: a logistic scale per event, so a big tick never zooms more than 2×
export function wheelZoomDelta(event: WheelSample, pageHeight: number): number {
  const [, deltaY] = toPixels(event, pageHeight);
  if (deltaY === 0) return 0;
  // Like MapLibre, a single macOS step keeps the fine rate and only larger ones take the coarse one
  const coarse = isMacWheelStep(event) ? Math.abs(deltaY) > MAC_WHEEL_STEP : !isTouchpadDeltaY(deltaY);
  const rate = coarse ? COARSE_ZOOM_RATE : FINE_ZOOM_RATE;
  const scale = MAX_SCALE_PER_EVENT / (1 + Math.exp(-Math.abs(deltaY) * rate));
  // Scrolling down (positive deltaY) zooms out
  return deltaY > 0 ? -Math.log2(scale) : Math.log2(scale);
}
