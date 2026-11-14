import { expect, test, type Page } from "@playwright/test";
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
    await choose(page, IBERA);
    await expect(markers(page)).toHaveCount(12, { timeout: 15_000 });
    const zoom = () => page.locator("[data-map]").getAttribute("data-zoom").then(Number);
    const landed = await zoom();
    await expect.poll(zoom, { timeout: 10_000 }).toBeGreaterThan(landed);
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
    const osm = page.getByRole("link", { name: "© OpenStreetMap" });
    await expect(osm).toBeVisible();
    const [sheetBox, osmBox] = [await sheet.boundingBox(), await osm.boundingBox()];
    expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(osmBox!.y + 1);
  });

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
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>("img")].every((img) => img.complete),
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
