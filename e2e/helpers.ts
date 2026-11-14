import { existsSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { gzipSync } from "node:zlib";
import { expect, type APIRequestContext, type Page, type Route } from "@playwright/test";
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

// Sums the gzip size of every <script src> in the page's HTML, so it needs no browser
export async function measureInitialJs(
  request: APIRequestContext,
  path = "/",
): Promise<{ gzipBytes: number; scripts: string[] }> {
  const page = await request.get(path);
  const html = await page.text();
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (match) => new URL(match[1].replaceAll("&amp;", "&"), page.url()).href,
  );
  let gzipBytes = 0;
  for (const url of new Set(scripts)) {
    const body = await (await request.get(url)).body();
    gzipBytes += gzipSync(body).length;
  }
  return { gzipBytes, scripts };
}

const SPRITES = join(__dirname, "fixtures", "sprites");
// The CORS headers GitHub's raw host really sends
const RAW_GITHUB = { "access-control-allow-origin": "*", "cross-origin-resource-policy": "cross-origin" };

// PokéAPI's sprites and cries live on GitHub; a tiny fixture keeps the run offline and deterministic
export async function mockPokeApiAssets(page: Page): Promise<void> {
  await page.route("https://raw.githubusercontent.com/**", (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(".gif")) {
      return route.fulfill({ path: join(SPRITES, "animated.gif"), contentType: "image/gif", headers: RAW_GITHUB });
    }
    if (path.endsWith(".png")) {
      return route.fulfill({ path: join(SPRITES, "still.png"), contentType: "image/png", headers: RAW_GITHUB });
    }
    return route.fulfill({ status: 404, headers: RAW_GITHUB });
  });
}
