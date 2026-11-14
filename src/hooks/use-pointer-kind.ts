import { useSyncExternalStore } from "react";

// coarse: touch is the main input; fine: mouse, touchpad or keyboard only; hybrid: both, like a touch-screen laptop
export type PointerKind = "coarse" | "fine" | "hybrid";

const COARSE = "(pointer: coarse)";
const FINE_HOVER = "(pointer: fine) and (hover: hover)";
const ANY_COARSE = "(any-pointer: coarse)";
type Lists = { coarse: MediaQueryList; fineHover: MediaQueryList; anyCoarse: MediaQueryList };

// Made on first use (never on the server) and shared by subscribe and read, which runs on every render
let lists: Lists | null = null;

function getLists(): Lists {
  lists ??= {
    coarse: window.matchMedia(COARSE),
    fineHover: window.matchMedia(FINE_HOVER),
    anyCoarse: window.matchMedia(ANY_COARSE),
  };
  return lists;
}

function subscribe(onChange: () => void) {
  const all = Object.values(getLists());
  for (const list of all) list.addEventListener("change", onChange);
  return () => {
    for (const list of all) list.removeEventListener("change", onChange);
  };
}

function read(): PointerKind {
  const { coarse, fineHover, anyCoarse } = getLists();
  if (coarse.matches) return "coarse";
  if (anyCoarse.matches) return fineHover.matches ? "hybrid" : "coarse";
  // Without any coarse pointer, mouse, touchpad and keyboard are what is left
  return "fine";
}

// null until hydrated: the server cannot know the device
export function usePointerKind(): PointerKind | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
