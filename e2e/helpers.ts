import { existsSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route } from "@playwright/test";
import messages from "../messages/es-AR.json";

export async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const details = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodes]`,
  );
  expect(details, `Accessibility violations:\n${details.join("\n")}`).toEqual([]);
}

export async function expectScreenshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    // Hides the map canvas rather than masking it: a mask paints over its whole box,
    // and the map fills the screen under the brand, notices and controls
    stylePath: join(__dirname, "screenshot.css"),
    animations: "disabled",
  });
}

// Downloaded from https://tiles.openfreemap.org on 2026-11-13: planet.json is the real TileJSON
// with `tiles` pointed at a fixture path; the glyph ranges are OpenFreeMap's Noto Sans (OFL)
const FIXTURES = join(__dirname, "fixtures", "openfreemap");
const OPENFREEMAP = "https://tiles.openfreemap.org/**";
// MapLibre fetches with CORS, so every fulfilled response must allow the page's origin
const CORS = { "access-control-allow-origin": "*" };

type MockOptions = { delayMs?: number; fail?: boolean };

// Tiles answer 204 (an empty tile): the map reaches "load" without any real geometry
export async function mockOpenFreeMap(page: Page, options: MockOptions = {}): Promise<void> {
  // Replaces a previous mock, so a test can switch from failing to working
  await page.unroute(OPENFREEMAP);
  await page.route(OPENFREEMAP, async (route: Route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (path === "/planet") {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.fail) return route.abort("failed");
      return route.fulfill({ path: join(FIXTURES, "planet.json"), contentType: "application/json", headers: CORS });
    }
    const glyphs = /^\/fonts\/([^/]+)\/(\d+-\d+)\.pbf$/.exec(path);
    if (glyphs) {
      const file = join(FIXTURES, "fonts", glyphs[1], `${glyphs[2]}.pbf`);
      if (existsSync(file)) {
        return route.fulfill({ path: file, contentType: "application/x-protobuf", headers: CORS });
      }
    }
    return route.fulfill({ status: 204, headers: CORS });
  });
}

// Generous because CI renders WebGL in software
export async function waitForMapReady(page: Page): Promise<void> {
  await expect(page.getByRole("region", { name: messages.Map.region })).toHaveAttribute("aria-busy", "false", {
    timeout: 30_000,
  });
}
