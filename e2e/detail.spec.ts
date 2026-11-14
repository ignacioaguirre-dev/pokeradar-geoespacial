import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/es-AR.json";
import {
  expectNoA11yViolations,
  expectScreenshot,
  mockOpenFreeMap,
  mockPokeApiAssets,
  waitForMapReady,
} from "./helpers";

const t = messages.Creature;
const STATS = [
  [messages.Stats.hp, 35],
  [messages.Stats.attack, 55],
  [messages.Stats.defense, 40],
  [messages.Stats.specialAttack, 50],
  [messages.Stats.specialDefense, 50],
  [messages.Stats.speed, 90],
] as const;

// Next's route announcer is also an alert, always present and empty
function detailAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: t.errorTitle });
}

// The panel's bars grow in; the last one landing on its value means the reading is complete
async function waitForReading(page: Page) {
  const panel = page.getByRole("region", { name: "Pikachu" });
  // Generous: the first request on a cold server also waits for the fixture upstream
  await expect(panel.getByRole("meter", { name: messages.Stats.speed })).toHaveAttribute("value", "90", {
    timeout: 15_000,
  });
  return panel;
}

test.beforeEach(async ({ page }) => {
  await mockOpenFreeMap(page);
  await mockPokeApiAssets(page);
});

test("a shared link opens the creature's detail @critical", async ({ page }) => {
  await page.goto("/?creature=25");
  const panel = await waitForReading(page);
  await expect(panel.getByRole("heading", { level: 2, name: "Pikachu" })).toBeVisible();
  await expect(panel.getByText("#025")).toBeVisible();
  await expect(panel.getByRole("list", { name: t.types })).toContainText(messages.Types.electric);
  await expect(panel.getByRole("meter")).toHaveCount(6);
  for (const [name, value] of STATS) {
    await expect(panel.getByRole("meter", { name, exact: true })).toHaveAttribute("value", String(value));
  }
  await expect(panel.getByText("0,4 m")).toBeVisible();
  await expect(panel.getByText("6,0 kg")).toBeVisible();
  await expect(panel.getByRole("img", { name: "Pikachu" })).toBeVisible();
  await expect(panel.getByRole("link", { name: t.attribution })).toHaveAttribute("href", "https://pokeapi.co");
  await expectNoA11yViolations(page);
});

test("an upstream failure shows the error and retry asks again", async ({ page }) => {
  await page.goto("/?creature=26");
  const alert = detailAlert(page);
  await expect(alert).toContainText(t.errorBody);
  const retried = page.waitForRequest((request) => request.url().endsWith("/api/creatures/26"));
  await alert.getByRole("button", { name: t.retry }).click();
  await retried;
  // The fixture server keeps failing, so the error comes back with its retry
  await expect(detailAlert(page).getByRole("button", { name: t.retry })).toBeVisible();
});

test("an id outside the catalog opens nothing", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/creatures/")) requests.push(request.url());
  });
  await page.goto("/?creature=999");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: t.region })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.close })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("Escape closes it, drops the parameter and returns focus to the map", async ({ page }) => {
  await page.goto("/?creature=25");
  await waitForReading(page);
  await expect(page.getByRole("heading", { level: 2, name: "Pikachu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Pikachu" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: messages.Map.region })).toBeFocused();
  expect(new URL(page.url()).search).toBe("");
});

test.describe("opened from inside the app", () => {
  // Stands in for a marker tap (unit 08): the same history entry openCreature pushes
  async function openInApp(page: Page) {
    // Next patches history.pushState once hydrated; a ready map means the page is
    await waitForMapReady(page);
    await page.evaluate(() => window.history.pushState({ creatureDetail: true }, "", "/?creature=25"));
    await waitForReading(page);
  }

  test("the browser's back button closes it", async ({ page }) => {
    await page.goto("/");
    await openInApp(page);
    await page.goBack();
    await expect(page.getByRole("region", { name: "Pikachu" })).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
  });

  test("Close goes back to the entry before it", async ({ page }) => {
    await page.goto("/");
    const before = await page.evaluate(() => window.history.length);
    await openInApp(page);
    await page.getByRole("button", { name: t.close }).click();
    await expect(page.getByRole("region", { name: "Pikachu" })).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).search).toBe("");
    // Close went back: only the panel's own entry exists (now ahead), none stacked on top of it
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    expect(await page.evaluate(() => (window.history.state as { creatureDetail?: boolean } | null)?.creatureDetail)).toBeUndefined();
  });
});

test("with reduced motion the sprite is the still one", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?creature=25");
  const panel = await waitForReading(page);
  const sprite = panel.getByRole("img", { name: "Pikachu" });
  await expect.poll(() => sprite.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/25\.png$/);
});

test("without reduced motion the sprite is animated", async ({ page }) => {
  await page.goto("/?creature=25");
  const panel = await waitForReading(page);
  const sprite = panel.getByRole("img", { name: "Pikachu" });
  await expect.poll(() => sprite.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\/25\.gif$/);
});

for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  test(`the detail looks unchanged at ${width} px @visual`, async ({ page }) => {
    // Reduced motion: the bars land at once and the sprite is the still frame, so the capture is stable
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height });
    await page.goto("/?creature=25");
    const panel = await waitForReading(page);
    await expect(panel.getByRole("img", { name: "Pikachu" })).toHaveJSProperty("complete", true);
    await page.evaluate(() => document.fonts.ready);
    await expectScreenshot(page, `detail-${width}`);
  });
}
