import { afterEach, describe, expect, it, vi } from "vitest";
import { closeCreature, openCreature, parseCreatureId } from "./history";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("parseCreatureId", () => {
  it.each([
    ["1", 1],
    ["25", 25],
    ["386", 386],
  ])("accepts %j", (raw, id) => {
    expect(parseCreatureId(raw)).toBe(id);
  });

  it.each([null, "", "0", "387", "999", "-1", "2.5", "025", "25abc", " 25", "1e2"])("ignores %j", (raw) => {
    expect(parseCreatureId(raw)).toBeNull();
  });
});

describe("openCreature and closeCreature", () => {
  it("opening adds the parameter as a new history entry", () => {
    window.history.replaceState(null, "", "/?zoom=3");
    const length = window.history.length;
    openCreature(25);
    expect(window.location.search).toBe("?zoom=3&creature=25");
    expect(window.history.length).toBe(length + 1);
  });

  it("closing what the panel opened goes back", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    openCreature(25);
    closeCreature();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("closing a shared link replaces the URL without the parameter", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    window.history.replaceState(null, "", "/?creature=25&zoom=3");
    const length = window.history.length;
    closeCreature();
    expect(back).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?zoom=3");
    expect(window.history.length).toBe(length);
  });

  // Hopping between creatures must not pile entries up: one back still closes the panel
  it("opening another creature with the panel open replaces the entry", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    openCreature(25);
    const length = window.history.length;
    openCreature(7);
    expect(window.location.search).toBe("?creature=7");
    expect(window.history.length).toBe(length);
    closeCreature();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("opening another creature over a shared link keeps closing inside the app", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    window.history.replaceState(null, "", "/?creature=25");
    const length = window.history.length;
    openCreature(7);
    expect(window.location.search).toBe("?creature=7");
    expect(window.history.length).toBe(length);
    closeCreature();
    expect(back).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});
