import { expect, test } from "@playwright/test";
import baseline from "../tooling/initial-js-baseline.json";
import { measureInitialJs } from "./helpers";

// Chromium only: the budget is about the bytes the server sends, not the browser
test.skip(({ browserName }) => browserName !== "chromium", "The budget does not depend on the browser");

test("initial JS has no MapLibre", async ({ request }) => {
  const { scripts } = await measureInitialJs(request);
  expect(scripts.length).toBeGreaterThan(0);
  for (const url of scripts) {
    const body = await (await request.get(url)).text();
    expect(body, `${url} carries MapLibre`).not.toContain("maplibregl-canvas");
  }
});

test("initial JS stays within budget", async ({ request }) => {
  const { gzipBytes } = await measureInitialJs(request);
  expect(gzipBytes).toBeLessThanOrEqual(baseline.gzipBytes + 10_240);
});
