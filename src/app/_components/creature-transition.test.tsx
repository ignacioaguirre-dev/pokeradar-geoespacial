import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCreature } from "@/features/creature/history";
import { isOpeningWithTransition, openCreatureFromMap, SPRITE_SLOT } from "./creature-transition";

vi.mock("@/features/creature/history", () => ({ openCreature: vi.fn() }));

function marker(id: number): HTMLImageElement {
  const button = document.createElement("button");
  button.className = "sweep-marker";
  button.dataset.creature = String(id);
  const sprite = document.createElement("img");
  button.append(sprite);
  document.body.append(button);
  return sprite;
}

type Doc = { startViewTransition?: unknown };

describe("openCreatureFromMap", () => {
  let reduced = false;

  beforeEach(() => {
    reduced = false;
    window.matchMedia = vi.fn(() => ({ matches: reduced })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    document.body.replaceChildren();
    delete (document as Doc).startViewTransition;
    vi.mocked(openCreature).mockClear();
  });

  it("opens plainly where the browser has no view transitions", () => {
    const sprite = marker(25);
    openCreatureFromMap(25);
    expect(openCreature).toHaveBeenCalledExactlyOnceWith(25);
    expect(sprite.style.viewTransitionName).toBe("");
    expect(isOpeningWithTransition()).toBe(false);
  });

  it("names the marker's image for the old frame and frees the name for the detail's", async () => {
    const sprite = marker(25);
    let finish = () => {};
    const finished = new Promise<void>((resolve) => (finish = resolve));
    let update: () => Promise<void> = async () => {};
    (document as Doc).startViewTransition = vi.fn((callback: () => Promise<void>) => {
      update = callback;
      return { finished };
    });

    openCreatureFromMap(25);
    expect(sprite.style.viewTransitionName).toBe("creature-sprite");
    expect(openCreature).not.toHaveBeenCalled();
    expect(isOpeningWithTransition()).toBe(true);

    // The detail's sprite is on the page by the time the new frame is taken
    const slot = document.createElement("span");
    slot.setAttribute(SPRITE_SLOT, "");
    const updated = update();
    document.body.append(slot);
    await updated;
    expect(sprite.style.viewTransitionName).toBe("");
    expect(openCreature).toHaveBeenCalledExactlyOnceWith(25);

    finish();
    await finished;
    await Promise.resolve();
    expect(isOpeningWithTransition()).toBe(false);
  });

  it("opens plainly under reduced motion", () => {
    marker(25);
    (document as Doc).startViewTransition = vi.fn();
    reduced = true;
    openCreatureFromMap(25);
    expect((document as Doc).startViewTransition).not.toHaveBeenCalled();
    expect(openCreature).toHaveBeenCalledExactlyOnceWith(25);
  });

  // Two elements would claim the same transition name
  it("opens plainly with the detail already open", () => {
    marker(25);
    (document as Doc).startViewTransition = vi.fn();
    const slot = document.createElement("span");
    slot.setAttribute(SPRITE_SLOT, "");
    document.body.append(slot);
    openCreatureFromMap(25);
    expect((document as Doc).startViewTransition).not.toHaveBeenCalled();
    expect(openCreature).toHaveBeenCalledExactlyOnceWith(25);
  });

  it("opens plainly a creature with no marker on the map", () => {
    (document as Doc).startViewTransition = vi.fn();
    openCreatureFromMap(7);
    expect((document as Doc).startViewTransition).not.toHaveBeenCalled();
    expect(openCreature).toHaveBeenCalledExactlyOnceWith(7);
  });
});
