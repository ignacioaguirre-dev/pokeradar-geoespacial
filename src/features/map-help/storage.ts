// A per-person convenience: if storage is unavailable the help simply shows again on the next visit.
// Versioned so a future change to the help can show it again to people who dismissed this one
export const MAP_HELP_SEEN_KEY = "pokeradar:map-help-seen:v1";

export type MapHelpStore = {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): boolean;
  markSeen(): void;
};

export function createMapHelpStore(): MapHelpStore {
  // undefined until first asked: storage is read once, lazily, not on every render
  let seen: boolean | undefined;
  const listeners = new Set<() => void>();

  function read(): boolean {
    try {
      return localStorage.getItem(MAP_HELP_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot() {
      seen ??= read();
      return seen;
    },
    markSeen() {
      // The cache is the source of truth for this page, so a failed write still closes the help
      seen = true;
      try {
        localStorage.setItem(MAP_HELP_SEEN_KEY, "1");
      } catch {
        // Nothing to do: the help shows again on the next visit
      }
      for (const listener of listeners) listener();
    },
  };
}

const store = createMapHelpStore();

export const subscribe = store.subscribe;
export const getSnapshot = store.getSnapshot;
export const markMapHelpSeen = store.markSeen;
