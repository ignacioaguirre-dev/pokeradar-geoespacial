import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function esperarSinViolaciones(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const detalle = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} nodos]`,
  );
  expect(detalle, `Violaciones de accesibilidad:\n${detalle.join("\n")}`).toEqual([]);
}

export async function capturar(page: Page, nombre: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${nombre}.png`, {
    fullPage: true,
    // The map canvas is nondeterministic across GPUs, so it is masked
    mask: [page.locator("[data-mapa]")],
    animations: "disabled",
  });
}
