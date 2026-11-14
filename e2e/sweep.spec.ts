import { expect, type Locator, test, type Page } from "@playwright/test";
import messages from "../messages/es-AR.json";
import {
  expectNoA11yViolations,
  expectScreenshot,
  mockOpenFreeMap,
  mockPokeApiAssets,
  waitForMapReady,
} from "./helpers";

const t = messages.Sweep;
const IBERA = messages.Fences.ibera;
const SEA = messages.Fences.sea;
// Pinned by the real-data snapshot of src/features/sightings/queries.test.ts
const IBERA_READING = "Esteros del Iberá: 12 criaturas detectadas y 36 señales débiles. Achicá la cerca para resolverlas.";
const SEA_READING = "Mar Argentino: 12 criaturas detectadas y 7 señales débiles. Achicá la cerca para resolverlas.";
const VIEW = /^Ver /;

// The markers live inside the map region; the list sits in the sweep panel
function markers(page: Page) {
  return page.getByRole("region", { name: messages.Map.region }).getByRole("button", { name: VIEW });
}

function list(page: Page, fence: string) {
  return page.getByRole("list", { name: t.list.replace("{fence}", fence) }).getByRole("button", { name: VIEW });
}

function reading(page: Page) {
  return page.getByRole("status").filter({ hasText: /criatura/ });
}

async function labels(locator: ReturnType<typeof markers>): Promise<(string | null)[]> {
  return locator.evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
}

// Every sprite decoded and every entrance animation over
function markersSettled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const bodies = [...document.querySelectorAll<HTMLElement>("[data-map] .sweep-marker__body")];
    return (
      bodies.length > 0 &&
      bodies.every((body) => body.querySelector("img")?.complete) &&
      bodies.every((body) => body.getAnimations().every((a) => a.playState === "finished"))
    );
  });
}

type Box = { x: number; y: number; width: number; height: number };

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// Every pair of the named parts, measured where they are now; touching edges do not count
async function expectApart(parts: Record<string, Locator>): Promise<void> {
  const boxes = await Promise.all(
    Object.entries(parts).map(async ([name, locator]) => {
      const box = await locator.boundingBox();
      expect(box, `${name} is not on screen`).not.toBeNull();
      return [name, box!] as const;
    }),
  );
  for (const [i, [name, box]] of boxes.entries()) {
    for (const [other, otherBox] of boxes.slice(i + 1)) {
      expect(overlap(box, otherBox), `${name} ${JSON.stringify(box)} overlaps ${other} ${JSON.stringify(otherBox)}`).toBe(
        false,
      );
    }
  }
}

// Measured where it rests, not mid-entrance; motion may cancel an animation it replaces, which rejects `finished`
async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))),
  );
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await locator.boundingBox());
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
}

async function choose(page: Page, fence: string) {
  await page.getByRole("button", { name: fence, exact: true }).click();
  await expect(page.getByRole("button", { name: fence, exact: true })).toHaveAttribute("aria-pressed", "true");
}

test.describe("with WebGL2", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName === "firefox" && Boolean(process.env.CI), "Headless Firefox has no WebGL2 in CI");
    await mockOpenFreeMap(page);
    await mockPokeApiAssets(page);
  });

  test("a fence sweeps into as many markers as its reading counts, in the list's order @critical", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    await expect(reading(page)).toHaveText(IBERA_READING);
    // Generous: the camera flies and the sweep plays before the markers land, slower on software WebGL
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
    await expect(list(page, IBERA)).toHaveCount(12);
    expect(await labels(markers(page))).toEqual(await labels(list(page, IBERA)));
    // The markers have drawn their sprites and finished their entrance before axe looks at them
    await expect.poll(() => markersSettled(page)).toBe(true);
    await expectNoA11yViolations(page);
  });

  test("Enter on a marker flies to the creature and opens its detail", async ({ page }) => {
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    const first = markers(page).first();
    await expect(first).toBeVisible({ timeout: 15_000 });
    const name = (await first.getAttribute("aria-label"))!.replace(VIEW, "");
    await first.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("region", { name });
    await expect(panel.getByRole("heading", { level: 2, name })).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("creature")).toMatch(/^\d+$/);
    // The camera comes close to the creature (data-zoom is written when a zoom ends)
    await expect.poll(async () => Number(await page.locator("[data-map]").getAttribute("data-zoom")), {
      timeout: 10_000,
    }).toBeGreaterThanOrEqual(7);
  });

  test("the keyboard reaches the fences, the markers and the list", async ({ page }) => {
    await page.goto("/");
    await waitForMapReady(page);
    await page.getByRole("button", { name: IBERA, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });

    // From the canvas, the markers come next
    await page.getByRole("application", { name: messages.Map.region }).focus();
    await page.keyboard.press("Tab");
    await expect(markers(page).first()).toBeFocused();

    // From the chosen fence on, every creature of the list comes before the map controls
    await page.getByRole("button", { name: IBERA, exact: true }).focus();
    const reached: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.getAttribute("aria-label") ?? active?.textContent ?? "";
      });
      if (label === messages.Map.legend) break;
      reached.push(label);
    }
    expect(reached.filter((label) => VIEW.test(label))).toEqual(await labels(list(page, IBERA)));
  });

  test("the active fence pressed again replays its sweep", async ({ page }) => {
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
    await choose(page, IBERA);
    // The replay takes the markers away and brings them back once the traces land again
    await expect(markers(page)).toHaveCount(0);
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
  });

  test("another fence takes the previous markers away", async ({ page }) => {
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
    const ibera = await labels(markers(page));

    await choose(page, SEA);
    await expect(reading(page)).toHaveText(SEA_READING);
    await expect.poll(() => labels(markers(page)), { timeout: 15_000 }).toEqual(await labels(list(page, SEA)));
    expect(await labels(markers(page))).not.toEqual(ibera);
  });

  test("with reduced motion the sweep lands at once, without animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForMapReady(page);
    // Clicked in-page, so the count is read a couple of frames after the tap with no round trip in between
    const landed = await page.evaluate(async (fence) => {
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent === fence);
      button?.click();
      await frame();
      await frame();
      const markers = [...document.querySelectorAll<HTMLElement>("[data-map] .sweep-marker__body")];
      return { count: markers.length, animations: markers.map((m) => getComputedStyle(m).animationName) };
    }, IBERA);
    expect(landed.count).toBe(12);
    expect(new Set(landed.animations)).toEqual(new Set(["none"]));
  });

  // Seen top to bottom as the keyboard reaches them: the fences, then what they found
  test("on phones the reading and the list sit below the fences", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    await expect(list(page, IBERA)).toHaveCount(12);
    const fences = await page.getByRole("group", { name: t.fences }).boundingBox();
    const readingBox = await reading(page).boundingBox();
    const listBox = await page.getByRole("list", { name: t.list.replace("{fence}", IBERA) }).boundingBox();
    expect(readingBox!.y).toBeGreaterThanOrEqual(fences!.y + fences!.height);
    expect(listBox!.y).toBeGreaterThanOrEqual(readingBox!.y + readingBox!.height);
  });

  // Iberá traces the creatures nearest its center: on a phone the camera closes in until none hides another
  // The traced creatures are the nearest to the center, so they land packed together: the camera closes in on
  // them (up to a regional view, so a few close pairs may still touch) and keeps every one of them on screen
  test("on phones the camera closes in on packed markers, keeping all of them in view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForMapReady(page);
    // Every zoom the map settles on from here: the fence's frame first, then the closer one on its creatures.
    // Recorded instead of read afterwards, because on a slow run the camera has closed in before the markers show
    await page.evaluate(() => {
      const map = document.querySelector("[data-map]")!;
      const seen: number[] = [];
      (window as unknown as { __zooms: number[] }).__zooms = seen;
      new MutationObserver(() => seen.push(Number(map.getAttribute("data-zoom")))).observe(map, {
        attributeFilter: ["data-zoom"],
      });
    });
    await choose(page, IBERA);
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
    const zooms = () => page.evaluate(() => [...new Set((window as unknown as { __zooms: number[] }).__zooms)]);
    await expect.poll(async () => (await zooms()).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    const [framed, ...closer] = await zooms();
    expect(closer.at(-1)).toBeGreaterThan(framed);
    const boxes = await markers(page).evaluateAll((buttons) =>
      buttons.map((b) => {
        const { x, y, width, height } = b.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    // In view means above the sweep panel, which covers the bottom of the map on phones
    const panelTop = await page.getByRole("group", { name: t.fences }).evaluate(
      (group) => group.parentElement!.getBoundingClientRect().top,
    );
    for (const box of boxes) {
      expect(box.y + box.height, `marker under the panel at ${panelTop}`).toBeLessThanOrEqual(panelTop);
    }
  });

  test("on phones the detail sheet leaves the map attribution in view", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForMapReady(page);
    await choose(page, IBERA);
    await list(page, IBERA).first().click();
    const sheet = page.getByRole("region", { name: /./ }).filter({ has: page.getByRole("heading", { level: 2 }) });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    // Folded behind one button on phones; still in reach under the sheet
    const attribution = page.getByRole("contentinfo", { name: messages.Map.attribution });
    await expect(attribution).toBeVisible();
    await settled(sheet);
    const [sheetBox, attributionBox] = [await sheet.boundingBox(), await attribution.boundingBox()];
    expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(attributionBox!.y + 1);
  });

  // Phones: the sweep panel across the bottom, the control column at the right, the folded attribution below, and the
  // help beside the column or in a sheet. Desktop: the sweep panel at the left, the legend row and the controls at the
  // bottom, the help above them. The detail joins them once a creature opens
  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`at ${width} px the sweep panel, the movement help, the controls and the detail never overlap`, async ({
      page,
    }) => {
      const phone = width < 768;
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await waitForMapReady(page);
      const panel = page.getByRole("group", { name: t.fences }).locator("..");
      const nav = page.getByRole("navigation", { name: messages.Map.controls });
      const attribution = page.getByRole("contentinfo", { name: messages.Map.attribution });
      // On phones the legend and the help are buttons of the column itself
      const controls: Record<string, Locator> = phone
        ? { nav, attribution }
        : {
            nav,
            attribution,
            legend: page.getByRole("button", { name: messages.Map.legend }),
            help: page.getByRole("button", { name: messages.MapHelp.title }),
          };
      const intro = page.getByRole("status").filter({ has: page.getByRole("button", { name: messages.MapHelp.dismiss }) });

      // First visit: the intro sits beside the column on phones, beside the sweep panel on desktop
      await expect(intro).toBeVisible();
      await expectApart({ panel, intro, ...controls });

      await page.getByRole("button", { name: messages.MapHelp.dismiss }).click();
      await choose(page, IBERA);
      await expect(list(page, IBERA)).toHaveCount(12);
      await expect(reading(page)).toHaveText(IBERA_READING);
      await expectApart({ panel, ...controls });

      // A sheet over everything on phones; on desktop a panel that never covers the reading or runs off the top
      await page.getByRole("button", { name: messages.MapHelp.title }).click();
      const helpPanel = page.getByRole(phone ? "dialog" : "region", { name: messages.MapHelp.title });
      await expect(helpPanel).toBeVisible();
      if (phone) {
        await expect.poll(async () => {
          const box = (await helpPanel.boundingBox())!;
          return box.y + box.height;
        }).toBeLessThanOrEqual(height);
      } else {
        await expectApart({ panel, helpPanel, ...controls });
      }
      expect((await helpPanel.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      await page.keyboard.press("Escape");
      await expect(helpPanel).toBeHidden();

      // On phones the sheet covers the sweep panel and the column steps aside; on desktop it floats at the right
      const first = list(page, IBERA).first();
      const name = (await first.getAttribute("aria-label"))!.replace(VIEW, "");
      await first.click();
      const sheet = page.getByRole("region", { name, exact: true });
      await expect(sheet.getByRole("heading", { level: 2, name })).toBeVisible({ timeout: 15_000 });
      await settled(sheet);
      if (phone) {
        await expect(nav).toHaveCount(0);
        await expectApart({ sheet, attribution });
        // A short phone still keeps some map above the sheet for the creature it is about
        expect((await sheet.boundingBox())!.y).toBeGreaterThanOrEqual(159);
      } else {
        await expectApart({ panel, sheet, ...controls });
        // Reopened beside the detail, the help panel stays clear of it
        await page.getByRole("button", { name: messages.MapHelp.title }).click();
        await expect(helpPanel).toBeVisible();
        await expectApart({ sheet, helpPanel, ...controls });
      }
    });
  }

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`a swept fence looks unchanged at ${width} px @visual`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await waitForMapReady(page);
      await choose(page, IBERA);
      await expect(markers(page)).toHaveCount(12);
      await page.evaluate(() => document.fonts.ready);
      // Only what is on screen: on phones the list scrolls sideways and its lazy sprites past the edge never load
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>("img")].every((img) => {
          const box = img.getBoundingClientRect();
          const onScreen = box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
          return img.complete || !onScreen;
        }),
      );
      await expectScreenshot(page, `sweep-${width}`);
    });
  }
});

// Sprites come from GitHub's raw host: the connection is ready before the first marker asks
test("preconnects anonymously to the sprite host", async ({ request }) => {
  const response = await request.get("/");
  const link = response.headers()["link"] ?? "";
  const preconnect = link
    .split(/,\s*(?=<)/)
    .find((entry) => entry.startsWith("<https://raw.githubusercontent.com>"));
  expect(preconnect, `no preconnect in Link: ${link}`).toBeDefined();
  expect(preconnect).toMatch(/crossorigin/i);
});
