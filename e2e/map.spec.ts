import { expect, test, type Page, type Response } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations, expectScreenshot, mockOpenFreeMap, waitForMapReady } from "./helpers";

const t = messages.Map;
// --color-foreground as getComputedStyle reports it
const FOREGROUND = "rgb(241, 237, 228)";
// A class only MapLibre's code writes, so it identifies the chunk that carries the map
const MAPLIBRE_MARKER = "maplibregl-canvas";

const ATTRIBUTIONS = [
  { name: "© OpenFreeMap", href: "https://openfreemap.org" },
  { name: "© OpenMapTiles", href: "https://openmaptiles.org" },
  { name: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { name: "© RESOLVE (CC BY 4.0)", href: "https://ecoregions.appspot.com" },
];

// Next's route announcer is also an alert, always present and empty
function mapAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /\S/ });
}

function isScript(response: Response): boolean {
  const type = response.headers()["content-type"] ?? "";
  return response.request().resourceType() === "script" || type.includes("javascript");
}

// Records every JS response in arrival order
function recordScripts(page: Page): Response[] {
  const scripts: Response[] = [];
  page.on("response", (response) => {
    if (isScript(response)) scripts.push(response);
  });
  return scripts;
}

async function scriptsWithMapLibre(scripts: Response[]): Promise<string[]> {
  const urls: string[] = [];
  for (const response of scripts) {
    const body = await response.body().catch(() => Buffer.alloc(0));
    if (body.toString("utf8").includes(MAPLIBRE_MARKER)) urls.push(response.url());
  }
  return urls;
}

test.describe("with WebGL2", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName === "firefox" && Boolean(process.env.CI), "Headless Firefox has no WebGL2 in CI");
    await mockOpenFreeMap(page);
  });

  test("the map loads and is accessible @critical", async ({ page }) => {
    const response = await page.goto("/");
    // Next sends the preconnect as a Link header rather than a <link> element
    const link = (await response?.headerValue("link")) ?? "";
    const preconnect = link.split(/,\s*(?=<)/).find((entry) => entry.startsWith("<https://tiles.openfreemap.org>"));
    expect(preconnect, `no preconnect in Link: ${link}`).toBeDefined();
    expect(preconnect).toMatch(/rel="?preconnect"?/);
    expect(preconnect).toMatch(/crossorigin/i);

    await waitForMapReady(page);
    await expect(page.getByRole("application", { name: t.region })).toBeVisible();
    for (const { name, href } of ATTRIBUTIONS) {
      const anchor = page.getByRole("link", { name });
      await expect(anchor).toBeVisible();
      await expect(anchor).toHaveAttribute("href", href);
    }
    await expectNoA11yViolations(page);
  });

  test("the map arrives in a single deferred chunk", async ({ page }) => {
    const scripts = recordScripts(page);
    const response = await page.goto("/");
    const html = (await response?.text()) ?? "";
    const initial = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
      (match) => new URL(match[1].replaceAll("&amp;", "&"), page.url()).href,
    );
    expect(initial.length).toBeGreaterThan(0);
    await waitForMapReady(page);

    const withMap = await scriptsWithMapLibre(scripts);
    expect(withMap).toHaveLength(1);
    expect(initial).not.toContain(withMap[0]);
  });

  test("shows an error and recovers with retry", async ({ page }) => {
    await mockOpenFreeMap(page, { fail: true });
    await page.goto("/");
    const alert = mapAlert(page);
    await expect(alert).toContainText(t.errorTitle);
    await expect(page.getByRole("region", { name: t.region })).toHaveAttribute("aria-busy", "true");

    await mockOpenFreeMap(page);
    await alert.getByRole("button", { name: t.retry }).click();
    await waitForMapReady(page);
    await expect(alert).toHaveCount(0);
  });

  test("warns when the map is slow", async ({ page }) => {
    // The warning appears at 8 s and the TileJSON arrives at 9 s
    test.setTimeout(60_000);
    await mockOpenFreeMap(page, { delayMs: 9_000 });
    await page.goto("/");
    await expect(page.getByRole("status")).toContainText(t.slow, { timeout: 15_000 });
    await waitForMapReady(page);
    await expect(page.getByText(t.slow)).toHaveCount(0);
  });

  test("shows the offline error", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "onLine", { get: () => false });
    });
    // The page itself must still be served, so only the map's requests fail
    await mockOpenFreeMap(page, { fail: true });
    await page.goto("/");
    const alert = mapAlert(page);
    await expect(alert).toContainText(t.offlineTitle);
    await expect(alert.getByRole("button", { name: t.retry })).toBeVisible();
  });

  test("no layout shift while loading", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await waitForMapReady(page);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.01);
  });

  test("keyboard order and zoom", async ({ page }) => {
    // No flight, so focus starts from the top of the page instead of where a skip leaves it
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForMapReady(page);
    // The project's ring: 2 px of foreground; the canvas draws it inset because MapLibre clips its overflow
    const ring = { style: "solid", width: "2px", color: FOREGROUND };
    const stops = [
      { locator: page.getByRole("application", { name: t.region }), offset: "-2px" },
      // The legend sits left of the controls, so it comes first in both reading and focus order
      { locator: page.getByRole("button", { name: t.legend }), offset: "2px" },
      { locator: page.getByRole("button", { name: t.zoomIn }), offset: "2px" },
      { locator: page.getByRole("button", { name: t.zoomOut }), offset: "2px" },
      { locator: page.getByRole("button", { name: t.reset }), offset: "2px" },
      ...ATTRIBUTIONS.map(({ name }) => ({ locator: page.getByRole("link", { name }), offset: "2px" })),
    ];
    for (const { locator, offset } of stops) {
      await page.keyboard.press("Tab");
      await expect(locator).toBeFocused();
      // Buttons transition their colors, so the ring is read once the transition settles
      await expect
        .poll(
          () =>
            locator.evaluate((el) => {
              const s = getComputedStyle(el);
              return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset };
            }),
          { message: await locator.evaluate((el) => el.outerHTML.slice(0, 80)) },
        )
        .toEqual({ ...ring, offset });
    }

    const map = page.locator("[data-map]");
    const before = Number(await map.getAttribute("data-zoom"));
    await page.getByRole("button", { name: t.zoomIn }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(before);
  });

  test("reduced motion jumps instead of animating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForMapReady(page);
    const before = Number(await page.locator("[data-map]").getAttribute("data-zoom"));
    // Clicked in-page so the two frames are read right after the action, with no round trip in between
    const frames = await page.evaluate(async (label) => {
      const read = () => Number(document.querySelector("[data-map]")?.getAttribute("data-zoom"));
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
      await frame();
      const first = read();
      await frame();
      return [first, read()];
    }, t.zoomIn);
    expect(frames[0]).toBe(frames[1]);
    // data-zoom is rounded to one decimal, so the step of 1 is compared within that rounding
    expect(Math.abs(frames[0] - (before + 1))).toBeLessThanOrEqual(0.1);
  });

  test.describe("entry flight", () => {
    const skipButton = (page: Page) => page.getByRole("button", { name: t.skipIntroLabel });
    const zoomOf = async (page: Page) => Number(await page.locator("[data-map]").getAttribute("data-zoom"));
    const regionBusy = (page: Page) => page.getByRole("region", { name: t.region });

    // The frame a plain load (no flight) lands on, to compare every way of ending the flight against
    async function finalZoom(page: Page): Promise<number> {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await waitForMapReady(page);
      const zoom = await zoomOf(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      return zoom;
    }

    async function startFlight(page: Page) {
      await page.goto("/");
      await expect(skipButton(page)).toBeVisible();
      await expect(regionBusy(page)).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeDisabled();
    }

    test("a load with the flight hydrates without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await startFlight(page);
      await skipButton(page).click();
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeEnabled();
      expect(errors).toEqual([]);
    });

    test("a map that fails to load ends the flight and leaves no globe edge", async ({ page }) => {
      await mockOpenFreeMap(page, { fail: true });
      await page.goto("/");
      await expect(mapAlert(page)).toContainText(t.errorTitle);
      await expect(skipButton(page)).toHaveCount(0);
      const map = page.locator("[data-map]");
      // Sampled for longer than MapLibre takes to fire its late load, and well inside the 3.5 s flight,
      // which would otherwise end on its own and hide the leak. Read once per sample: a retrying assertion would wait it out
      for (let i = 0; i < 15; i++) {
        expect(await map.locator("svg").filter({ visible: true }).count()).toBe(0);
        // Behind the notice, the sea, as on a load without the flight
        expect(await map.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(5, 11, 19)");
        await page.waitForTimeout(100);
      }
    });

    test("skip lands on the final frame with the map ready", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      await skipButton(page).click();
      await expect(skipButton(page)).toBeHidden();
      await expect(page.getByRole("application", { name: t.region })).toBeFocused();
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeEnabled();
      expect(await zoomOf(page)).toBe(final);

      // "Ver Argentina" returns to that same frame
      await page.getByRole("button", { name: t.zoomIn }).click();
      await expect.poll(() => zoomOf(page)).toBeGreaterThan(final);
      await page.getByRole("button", { name: t.reset }).click();
      await expect.poll(() => zoomOf(page)).toBe(final);
    });

    test("the flight ends by itself on the final frame", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      await expect(skipButton(page)).toBeHidden({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeEnabled();
      expect(await zoomOf(page)).toBe(final);
    });

    test("skip is the first Tab stop and works from the keyboard", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      await page.keyboard.press("Tab");
      await expect(skipButton(page)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(skipButton(page)).toBeHidden();
      await expect(page.getByRole("application", { name: t.region })).toBeFocused();
      expect(await zoomOf(page)).toBe(final);
    });

    test("a key on the map ends the flight", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      await page.getByRole("application", { name: t.region }).focus();
      // A key that moves nothing, so the frame stays the final one
      await page.keyboard.press("Shift");
      await expect(skipButton(page)).toBeHidden();
      expect(await zoomOf(page)).toBe(final);
    });

    test("a wheel on the map ends the flight", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      const box = await page.getByRole("application", { name: t.region }).boundingBox();
      if (!box) throw new Error("no canvas");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 100);
      await expect(skipButton(page)).toBeHidden();
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeEnabled();
      // The wheel then zooms out from the final frame, never from the globe
      await expect.poll(() => zoomOf(page)).toBeLessThan(final);
      expect(await zoomOf(page)).toBeGreaterThan(final - 1);
    });

    test("a tap on the map ends the flight", async ({ page }) => {
      const final = await finalZoom(page);
      await startFlight(page);
      await page.getByRole("application", { name: t.region }).click();
      await expect(skipButton(page)).toBeHidden();
      expect(await zoomOf(page)).toBe(final);
    });

    test("reduced motion opens on the final frame without a flight", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await expect(regionBusy(page)).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      await expect(skipButton(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: t.zoomIn })).toBeEnabled();
      const zoom = await zoomOf(page);
      expect(zoom).toBeGreaterThanOrEqual(2);
    });
  });

  test("the map follows a viewport change", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForMapReady(page);
    const canvas = page.getByRole("application", { name: t.region });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect
      .poll(async () => Math.abs(((await canvas.boundingBox())?.width ?? 0) - 844))
      .toBeLessThanOrEqual(1);
    await expect(page.getByRole("region", { name: t.region })).toHaveAttribute("aria-busy", "false");
  });

  for (const [width, height] of [
    [360, 800],
    [768, 1024],
    [1280, 800],
  ] as const) {
    test(`the home page looks unchanged at ${width} px @visual`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await waitForMapReady(page);
      await page.evaluate(() => document.fonts.ready);
      await expectScreenshot(page, `home-ready-${width}`);

      await mockOpenFreeMap(page, { fail: true });
      await page.reload();
      await expect(mapAlert(page)).toContainText(t.errorTitle);
      await page.evaluate(() => document.fonts.ready);
      await expectScreenshot(page, `home-error-${width}`);
    });
  }
});

test("explains when WebGL2 is missing", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    // Only WebGL2 disappears; the other context types keep working
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") return null;
      return (getContext as (this: HTMLCanvasElement, ...args: unknown[]) => RenderingContext | null).call(
        this,
        type,
        ...rest,
      );
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await mockOpenFreeMap(page);
  const scripts = recordScripts(page);
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(t.unsupportedTitle);
  await page.waitForLoadState("networkidle");
  expect(await scriptsWithMapLibre(scripts)).toEqual([]);
});
