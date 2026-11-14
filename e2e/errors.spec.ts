import { expect, type Page, test } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations, expectScreenshot, mockOpenFreeMap } from "./helpers";

const t = messages.AppError;
const notFound = messages.NotFound;

// Next's built-in screens, in English and without a way back: they must never reach a person
const GENERIC = /This page couldn.t load|could not be found|Application error/i;

// The map's region, not its drawing: headless Firefox in CI has no WebGL2, and these tests are about the way back
async function expectBackOnMap(page: Page) {
  await expect(page.getByRole("region", { name: messages.Map.region })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockOpenFreeMap(page);
});

test("a crash in the page shows the app's own error, and retry recovers @critical", async ({ page }) => {
  // The stage reads media queries while rendering, so a throwing matchMedia breaks the page the way a real bug would
  await page.addInitScript(() => {
    const w = window as unknown as { __crash: boolean };
    w.__crash = true;
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (w.__crash) throw new Error("simulated crash");
      return original(query);
    };
  });
  await page.goto("/");
  const alert = page.getByRole("alert").filter({ hasText: t.title });
  await expect(alert).toContainText(t.body);
  await expect(alert.getByRole("link", { name: t.backToMap })).toHaveAttribute("href", "/");
  await expect(page.getByText(GENERIC)).toHaveCount(0);
  await expect(page.getByText("simulated crash")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: messages.Home.heading })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.evaluate(() => {
    (window as unknown as { __crash: boolean }).__crash = false;
  });
  await alert.getByRole("button", { name: t.retry }).click();
  await expectBackOnMap(page);
  await expect(alert).toHaveCount(0);
});

test("an unknown address answers 404 and says so in Spanish, without the code on screen", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(notFound.metaTitle);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(GENERIC)).toHaveCount(0);
  // Next's route announcer is also an alert, always present and empty
  const alert = page.getByRole("alert").filter({ hasText: notFound.title });
  await expect(alert).toContainText(notFound.body);
  await expect(page.locator("body")).not.toContainText("404");
});

test("the unknown address leads back to the map and is accessible @critical", async ({ page }) => {
  await page.goto("/no-existe");
  const alert = page.getByRole("alert").filter({ hasText: notFound.title });
  await expect(alert).toBeVisible();
  await expectNoA11yViolations(page);
  await alert.getByRole("link", { name: notFound.backToMap }).click();
  await expect(page).toHaveURL("/");
  await expectBackOnMap(page);
});

for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  test(`the unknown address looks unchanged at ${width} px @visual`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/no-existe");
    await expect(page.getByRole("alert").filter({ hasText: notFound.title })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expectScreenshot(page, `not-found-${width}`);
  });
}
