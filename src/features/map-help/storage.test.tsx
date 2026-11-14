import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMapHelpStore, MAP_HELP_SEEN_KEY } from "./storage";

describe("map help store", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("has not been seen on a first visit", () => {
    expect(createMapHelpStore().getSnapshot()).toBe(false);
  });

  it("reads a mark left by an earlier visit", () => {
    localStorage.setItem(MAP_HELP_SEEN_KEY, "1");
    expect(createMapHelpStore().getSnapshot()).toBe(true);
  });

  it("remembers that it was seen", () => {
    const store = createMapHelpStore();
    store.markSeen();
    expect(store.getSnapshot()).toBe(true);
    expect(localStorage.getItem(MAP_HELP_SEEN_KEY)).toBe("1");
  });

  // Rendering asks for the snapshot many times; storage is read once, and lazily
  it("reads storage once and only when asked", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const store = createMapHelpStore();
    expect(getItem).not.toHaveBeenCalled();
    store.getSnapshot();
    store.getSnapshot();
    store.getSnapshot();
    expect(getItem).toHaveBeenCalledOnce();
  });

  it("tells its subscribers when the help is marked, until they leave", () => {
    const store = createMapHelpStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.markSeen();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    store.markSeen();
    expect(listener).toHaveBeenCalledOnce();
  });

  // Private windows and blocked site data throw on access: the help just shows again on the next visit
  it("survives a storage that throws, and still remembers for this page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createMapHelpStore();
    expect(store.getSnapshot()).toBe(false);
    expect(() => store.markSeen()).not.toThrow();
    expect(store.getSnapshot()).toBe(true);
  });
});
