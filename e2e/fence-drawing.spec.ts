import { expect, type Page, test } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations, expectScreenshot, mockOpenFreeMap, mockPokeApiAssets, waitForMapReady } from "./helpers";

const t = messages.FenceDrawing;
const OWN = t.own;

type LngLat = readonly [number, number];

// The map's own padding (map-stage.tsx): its center sits in the middle of what the padding leaves
const PADDING_NARROW = { top: 64, right: 68, bottom: 160, left: 12 };
const PADDING_WIDE = { top: 96, right: 120, bottom: 72, left: 352 };
// MapLibre's world is 512 px wide at zoom 0
const TILE = 512;

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// Where a place is on screen, from the center and zoom the map writes on its container after a move.
// Web Mercator, as MapLibre draws it; a tenth of a zoom level of rounding moves a point a few pixels at most
async function project(page: Page, [lng, lat]: LngLat): Promise<{ x: number; y: number }> {
  const map = page.locator("[data-map]");
  const [centerLng, centerLat] = (await map.getAttribute("data-center"))!.split(",").map(Number);
  const zoom = Number(await map.getAttribute("data-zoom"));
  const box = (await map.boundingBox())!;
  const { top, right, bottom, left } = box.width >= 768 ? PADDING_WIDE : PADDING_NARROW;
  const scale = (TILE * 2 ** zoom) / (2 * Math.PI);
  const cx = box.x + (left + box.width - right) / 2;
  const cy = box.y + (top + box.height - bottom) / 2;
  return {
    x: cx + ((lng - centerLng) * Math.PI) / 180 * scale,
    y: cy - (mercatorY(lat) - mercatorY(centerLat)) * scale,
  };
}

async function tapAt(page: Page, point: LngLat, touch: boolean) {
  const { x, y } = await project(page, point);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

// The center is written once a move ends; Ver Argentina makes one from the settled frame
async function openMap(page: Page) {
  await page.goto("/");
  await waitForMapReady(page);
  await page.getByRole("button", { name: messages.Map.reset }).click();
  await expect(page.locator("[data-map]")).toHaveAttribute("data-center", /,/);
}

async function startDrawing(page: Page) {
  await page.getByRole("button", { name: t.start }).click();
  await expect(page.getByRole("region", { name: t.title })).toBeVisible();
}

const count = (page: Page, n: number) =>
  expect(page.getByText(t.count.replace("{count}", String(n)).replace("{max}", "12"))).toBeVisible();

const closeButton = (page: Page) => page.getByRole("button", { name: t.close });

// Chaco and Santa Fe, well inside Argentina
const BOX: LngLat[] = [
  [-61, -27.5],
  [-59.5, -27.5],
  [-59.5, -29.5],
  [-61, -29.5],
];

test.describe("drawing an own fence", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName === "firefox" && Boolean(process.env.CI), "Headless Firefox has no WebGL2 in CI");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockOpenFreeMap(page);
    await mockPokeApiAssets(page);
  });

  test("four taps and Cerrar cerca sweep the drawn fence @critical", async ({ page }, { project: run }) => {
    const touch = Boolean(run.use.hasTouch);
    await openMap(page);
    await startDrawing(page);
    await expect(page.getByRole("button", { name: t.addHere })).toBeFocused();
    await expect(closeButton(page)).toBeDisabled();
    await expect(page.getByText("Faltan 3 vértices")).toBeVisible();
    for (const [i, point] of BOX.entries()) {
      await tapAt(page, point, touch);
      await count(page, i + 1);
    }
    await expect(closeButton(page)).toBeEnabled();
    await closeButton(page).click();
    await expect(page.getByRole("region", { name: t.title })).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: OWN })).toHaveText(new RegExp(`^${OWN}: `));
    await expect(page.getByRole("button", { name: t.start })).toBeFocused();
  });

  test("a drag moves the map and adds nothing", async ({ page }) => {
    await openMap(page);
    await startDrawing(page);
    const center = page.locator("[data-map]");
    const before = await center.getAttribute("data-center");
    const { x, y } = await project(page, BOX[0]);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(center).not.toHaveAttribute("data-center", before!);
    await count(page, 0);
  });

  test("the keyboard draws with the reticle: Enter adds, arrows move, Escape leaves", async ({ page }) => {
    await openMap(page);
    // Closer in, an arrow's step stays inside Buenos Aires instead of reaching the ocean or Chile
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: messages.Map.zoomIn }).click();
    await startDrawing(page);
    await page.getByRole("button", { name: t.addHere }).press("Enter");
    await count(page, 1);
    const map = page.getByRole("application", { name: messages.Map.region });
    await map.focus();
    const center = page.locator("[data-map]");
    for (const key of ["ArrowRight", "ArrowUp"]) {
      const before = await center.getAttribute("data-center");
      await page.keyboard.press(key);
      await expect(center).not.toHaveAttribute("data-center", before!);
      await page.keyboard.press("Enter");
    }
    await count(page, 3);
    await expect(closeButton(page)).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: t.title })).toBeHidden();
    await expect(page.getByRole("button", { name: t.start })).toBeFocused();
  });

  test("every rule says why, in its own words", async ({ page }) => {
    await openMap(page);
    await startDrawing(page);
    const alert = page.getByRole("region", { name: t.title }).getByRole("alert");

    await tapAt(page, [-71.5, -36], false);
    await expect(alert).toHaveText(t.outside);
    await count(page, 0);

    // From the third vertex back up across the first edge
    await tapAt(page, [-61, -27.5], false);
    await tapAt(page, [-59.3, -27.5], false);
    await tapAt(page, [-61, -29.5], false);
    await tapAt(page, [-60, -26.5], false);
    await expect(alert).toHaveText(t.crossing);
    await count(page, 3);

    // The edge back to the first vertex would cross the second one
    await tapAt(page, [-59.3, -29.5], false);
    await expect(closeButton(page)).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: t.crossing })).toBeVisible();

    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: t.undo }).click();
    await count(page, 0);

    // Twelve vertices around La Pampa, then one more
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI;
      await tapAt(page, [-65 + 2 * Math.cos(angle), -37 + 1.6 * Math.sin(angle)], false);
    }
    await count(page, 12);
    await tapAt(page, [-65, -37], false);
    await expect(alert).toHaveText(t.tooMany.replace("{max}", "12"));

    for (let i = 0; i < 12; i++) await page.getByRole("button", { name: t.undo }).click();

    // From Mendoza to Entre Ríos and down to Río Negro: well over the cap
    await tapAt(page, [-68, -33], false);
    await tapAt(page, [-59, -33], false);
    await tapAt(page, [-65, -40.5], false);
    await expect(closeButton(page)).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: t.tooLarge })).toBeVisible();

    await expectNoA11yViolations(page);
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`the drawing mode looks unchanged at ${width} px @visual`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openMap(page);
      await startDrawing(page);
      for (const point of BOX.slice(0, 3)) await tapAt(page, point, false);
      await count(page, 3);
      await page.evaluate(() => document.fonts.ready);
      await expectScreenshot(page, `fence-drawing-${width}`);
    });
  }
});
