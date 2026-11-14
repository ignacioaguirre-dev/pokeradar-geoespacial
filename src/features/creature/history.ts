import { SPECIES_COUNT } from "@/features/catalog/types";

export const CREATURE_PARAM = "creature";
// Marks the entries the panel pushed, so closing knows whether going back stays inside the app
const MARK = "creatureDetail";

const ID_PATTERN = /^[1-9]\d*$/;

// Anything but a plain catalog id is ignored: a shared or edited link never opens a broken panel
export function parseCreatureId(raw: string | null): number | null {
  if (raw === null || !ID_PATTERN.test(raw)) return null;
  const id = Number(raw);
  return id <= SPECIES_COUNT ? id : null;
}

function urlWith(id: number | null): URL {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete(CREATURE_PARAM);
  else url.searchParams.set(CREATURE_PARAM, String(id));
  return url;
}

function pushedByPanel(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && MARK in state;
}

// A new entry, so the browser's back button closes the panel. With the panel already open the entry is
// swapped instead, keeping its mark: hopping between creatures never stacks entries to go back through
export function openCreature(id: number): void {
  if (new URL(window.location.href).searchParams.has(CREATURE_PARAM)) {
    window.history.replaceState(pushedByPanel() ? { [MARK]: true } : null, "", urlWith(id));
    return;
  }
  window.history.pushState({ [MARK]: true }, "", urlWith(id));
}

export function closeCreature(): void {
  if (pushedByPanel()) {
    window.history.back();
    return;
  }
  // Opened from a link: going back would leave the app, so only the parameter goes.
  // null state: Next's patched replaceState only syncs useSearchParams for states it does not own
  window.history.replaceState(null, "", urlWith(null));
}
