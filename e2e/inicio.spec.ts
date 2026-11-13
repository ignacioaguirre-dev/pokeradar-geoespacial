import { expect, test } from "@playwright/test";
import { esperarSinViolaciones } from "./ayudas";

test("la página de inicio carga y es accesible @critico", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  await expect(page).toHaveTitle("PokeRadar Geoespacial");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await esperarSinViolaciones(page);
});
