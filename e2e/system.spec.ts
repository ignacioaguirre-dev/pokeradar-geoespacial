import { expect, test, type Page } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations, expectScreenshot } from "./helpers";

// Computed token values only appear after hydration
async function waitForColors(page: Page): Promise<void> {
  await expect(page.getByText(/^#[0-9a-f]{6}$/i).first()).toBeVisible();
}

test("/system loads and is accessible @critical", async ({ page, browserName }) => {
  await page.goto("/system");
  await expect(page).toHaveTitle(messages.System.metaTitle);
  await expect(page.getByRole("heading", { level: 1, name: messages.System.heading })).toBeVisible();
  await waitForColors(page);
  // Headless Firefox on the CI runner crashes ("Page crashed") while axe walks this page; the other four
  // profiles still check it
  if (browserName === "firefox" && process.env.CI) return;
  await expectNoA11yViolations(page);
});

test("/system is not indexable", async ({ page }) => {
  await page.goto("/system");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("/system can be traversed with the keyboard", async ({ page }) => {
  await page.goto("/system");
  const total = await page.getByRole("button").count();
  expect(total).toBeGreaterThan(0);
  const focusColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim(),
  );
  // Compare through a probe so hex and rgb() forms normalize to the same string
  const expected = await page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, focusColor);
  const visited = new Set<string>();
  for (let i = 0; i < total + 5 && visited.size < total; i++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el.tagName !== "BUTTON") return null;
      const s = getComputedStyle(el);
      return {
        text: el.textContent ?? "",
        outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
        shadow: s.boxShadow !== "none",
      };
    });
    if (!focus) continue;
    expect(focus.outline || focus.shadow, `no visible focus on "${focus.text}"`).toBe(true);
    // Retries because the outline color transitions in over --duration-fast
    await expect(page.locator(":focus"), `focus ring outside the system on "${focus.text}"`).toHaveCSS(
      "outline-color",
      expected,
    );
    visited.add(focus.text);
  }
  expect(visited.size).toBe(total);
});

test("/system does not shift when fonts load", async ({ page }) => {
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
  await page.goto("/system");
  await page.evaluate(() => document.fonts.ready);
  await waitForColors(page);
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.01);
});

test("/system honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/system");
  const duration = await page
    .getByRole("button", { name: messages.System.button.save })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe("0s");
});

test("/system looks unchanged @visual", async ({ page }) => {
  await page.goto("/system");
  await page.evaluate(() => document.fonts.ready);
  await waitForColors(page);
  await expectScreenshot(page, "system");
});

test("/system does not overflow horizontally", async ({ page }) => {
  for (const width of [360, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/system");
    await waitForColors(page);
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll, `overflow at ${width} px`).toBeLessThanOrEqual(inner);
  }
});
