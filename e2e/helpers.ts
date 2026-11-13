import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

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
    // The map canvas is nondeterministic across GPUs, so it is masked
    mask: [page.locator("[data-map]")],
    animations: "disabled",
  });
}
