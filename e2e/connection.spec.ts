import { expect, test, type Locator, type Page } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations, mockOpenFreeMap, mockPokeApiAssets, waitForMapReady } from "./helpers";

const t = messages.Connection;

function offlineNotice(page: Page) {
  return page.getByRole("status").filter({ hasText: t.offlineBody });
}

function recoveredNotice(page: Page) {
  return page.getByRole("status").filter({ hasText: t.recovered });
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as Box;
}

// Stands in for a marker tap, as in detail.spec
async function openCreature(page: Page, id: number) {
  await page.evaluate(
    (creature) => window.history.pushState({ creatureDetail: true }, "", `/?creature=${creature}`),
    id,
  );
}

test.beforeEach(async ({ page }) => {
  await mockOpenFreeMap(page);
  await mockPokeApiAssets(page);
});

test("losing the connection in use keeps the map and recovers the detail on its own", async ({ page, context }) => {
  await page.goto("/");
  await waitForMapReady(page);
  // The panel's chunk downloads the first time a creature opens: 26, which the fixture fails on purpose, brings it
  // in without caching Pikachu, so the cut below still leaves that request without a network
  await openCreature(page, 26);
  const upstreamError = page.getByRole("alert").filter({ hasText: messages.Creature.errorBody });
  await expect(upstreamError).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: messages.Creature.close }).click();
  await expect(upstreamError).toHaveCount(0);

  await context.setOffline(true);
  await expect(offlineNotice(page)).toContainText(t.offlineTitle);
  await expectNoA11yViolations(page);

  // The map keeps working with what it already loaded
  await expect(page.getByRole("region", { name: messages.Map.region })).toBeVisible();
  const zoomIn = page.getByRole("button", { name: messages.Map.zoomIn });
  await expect(zoomIn).toBeEnabled();
  await zoomIn.click();
  await expect(page.getByRole("region", { name: messages.Map.region })).toHaveAttribute("aria-busy", "false");

  // The request fails for lack of a network
  await openCreature(page, 25);
  const detailError = page.getByRole("alert").filter({ hasText: messages.Creature.errorTitle });
  await expect(detailError.getByRole("button", { name: messages.Creature.retry })).toBeVisible();

  await context.setOffline(false);
  await expect(recoveredNotice(page)).toBeVisible();
  await expect(offlineNotice(page)).toHaveCount(0);
  // Nobody touches retry: the detail asks again by itself
  const panel = page.getByRole("region", { name: "Pikachu" });
  await expect(panel.getByRole("meter", { name: messages.Stats.speed })).toBeVisible({ timeout: 15_000 });
  await expect(detailError).toHaveCount(0);
  // It hides itself after about three seconds
  await expect(recoveredNotice(page)).toHaveCount(0, { timeout: 6_000 });
});

test("on a phone the notice clears the detail's sheet and the map controls", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await waitForMapReady(page);
  await openCreature(page, 25);
  const sheet = page.getByRole("region", { name: "Pikachu" });
  await expect(sheet.getByRole("meter", { name: messages.Stats.speed })).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await expect(offlineNotice(page)).toBeVisible();
  expect(overlaps(await boxOf(offlineNotice(page)), await boxOf(sheet))).toBe(false);
  // The control column steps aside while the sheet is up, so there is nothing else to clear
  await expect(page.getByRole("navigation", { name: messages.Map.controls })).toHaveCount(0);
  await context.setOffline(false);
});

test("a cut shorter than a second shows nothing", async ({ page, context }) => {
  await page.goto("/");
  await waitForMapReady(page);
  await context.setOffline(true);
  await page.waitForTimeout(300);
  await context.setOffline(false);
  await page.waitForTimeout(1_500);
  await expect(offlineNotice(page)).toHaveCount(0);
  await expect(recoveredNotice(page)).toHaveCount(0);
});

test("the notice also shows outside the map, without motion when reduced", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/system");
  await context.setOffline(true);
  const notice = offlineNotice(page);
  await expect(notice).toBeVisible();
  expect(await notice.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await context.setOffline(false);
  await expect(recoveredNotice(page)).toBeVisible();
});
