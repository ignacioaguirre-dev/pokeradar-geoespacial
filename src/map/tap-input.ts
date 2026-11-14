// A press within both limits is a tap; more movement or a longer hold is the person moving the map.
// The distance allows for a finger's wobble; the time stays under the system's long press
export const TAP_MAX_PX = 8;
export const TAP_MAX_MS = 500;

type Press = { x: number; y: number; time: number };

// Reports taps on the canvas in its own pixels. Markers and other children are not the canvas, so
// pressing them never taps. A pinch is a tap of nobody: once a second pointer joins, nothing counts
// until every pointer is up
export function listenForTaps(
  target: HTMLElement,
  canvas: HTMLElement,
  onTap: (x: number, y: number) => void,
): () => void {
  const presses = new Map<number, Press>();
  let multi = false;

  const release = (id: number) => {
    const press = presses.get(id);
    presses.delete(id);
    const wasMulti = multi;
    if (presses.size === 0) multi = false;
    return wasMulti ? undefined : press;
  };

  const onDown = (event: PointerEvent) => {
    if (event.target !== canvas) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    presses.set(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp });
    if (presses.size > 1) multi = true;
  };
  const onUp = (event: PointerEvent) => {
    const press = release(event.pointerId);
    if (!press) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (moved > TAP_MAX_PX || event.timeStamp - press.time > TAP_MAX_MS) return;
    const rect = canvas.getBoundingClientRect();
    onTap(event.clientX - rect.left, event.clientY - rect.top);
  };
  const onCancel = (event: PointerEvent) => {
    release(event.pointerId);
  };

  // A press may end over the panels: heard on the window, it never stays pending and blocks the next tap
  const view = target.ownerDocument.defaultView ?? window;
  target.addEventListener("pointerdown", onDown);
  view.addEventListener("pointerup", onUp);
  view.addEventListener("pointercancel", onCancel);
  return () => {
    target.removeEventListener("pointerdown", onDown);
    view.removeEventListener("pointerup", onUp);
    view.removeEventListener("pointercancel", onCancel);
  };
}
