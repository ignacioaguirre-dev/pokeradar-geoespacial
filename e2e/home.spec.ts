import { expect, test } from "@playwright/test";
import messages from "../messages/es-AR.json";
import { expectNoA11yViolations } from "./helpers";

test("the home page loads and is accessible @critical", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  await expect(page).toHaveTitle(messages.Metadata.title);
  await expect(page.getByRole("heading", { level: 1, name: messages.Home.heading })).toBeVisible();
  await expectNoA11yViolations(page);
});
