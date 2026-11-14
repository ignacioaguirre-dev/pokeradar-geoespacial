import { openCreature } from "@/features/creature/history";

// On the detail's sprite, loading or loaded: where the marker's image lands
export const SPRITE_SLOT = "data-creature-sprite";

const REDUCED = "(prefers-reduced-motion: reduce)";
// The panel's chunk is preloaded, so its sprite shows within a few frames; past this the page must not stay frozen
const SLOT_WAIT_MS = 400;

let opening = false;

// True while the detail opens inside a view transition: the transition draws the panel's entrance, not the panel
export function isOpeningWithTransition(): boolean {
  return opening;
}

function slotShown(): Promise<void> {
  return new Promise((resolve) => {
    const deadline = performance.now() + SLOT_WAIT_MS;
    const look = () => {
      if (document.querySelector(`[${SPRITE_SLOT}]`) || performance.now() > deadline) resolve();
      else requestAnimationFrame(look);
    };
    look();
  });
}

// Opens the detail letting the creature's image travel from its marker to the panel. The marker lives in the
// map's own DOM, so it is found by its markup. Falls back to a plain open without the API, under reduced motion,
// without a marker on the map, or with the detail already open (two elements would claim the same name)
export function openCreatureFromMap(id: number): void {
  const source = document.querySelector<HTMLElement>(`.sweep-marker[data-creature="${id}"] img`);
  const plain =
    !source ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia(REDUCED).matches ||
    document.querySelector(`[${SPRITE_SLOT}]`) !== null;
  if (plain) {
    openCreature(id);
    return;
  }
  source.style.viewTransitionName = "creature-sprite";
  opening = true;
  const transition = document.startViewTransition(async () => {
    source.style.viewTransitionName = "";
    openCreature(id);
    await slotShown();
  });
  const settle = () => {
    opening = false;
    source.style.viewTransitionName = "";
  };
  transition.finished.then(settle, settle);
}
