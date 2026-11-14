import { expect, test } from "@playwright/test";
import { mockOpenFreeMap, waitForMapReady } from "./helpers";

test("/ sends the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("connect-src 'self' https://tiles.openfreemap.org");
  // Only GitHub's raw host joins, for PokéAPI's sprites and cries
  expect(csp).toContain("img-src 'self' data: blob: https://raw.githubusercontent.com;");
  expect(csp).toContain("media-src 'self' https://raw.githubusercontent.com;");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
});

test("the map works under the CSP @critical", async ({ page, browserName }) => {
  test.skip(browserName === "firefox" && Boolean(process.env.CI), "Headless Firefox has no WebGL2 in CI");
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  await mockOpenFreeMap(page);
  await page.goto("/");
  await waitForMapReady(page);
  expect(violations).toEqual([]);
});
