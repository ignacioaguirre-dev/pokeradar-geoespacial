import { expect, test, type Page } from "@playwright/test";
import { capturar, esperarSinViolaciones } from "./ayudas";

// Computed token values only appear after hydration
async function esperarColores(page: Page): Promise<void> {
  await expect(page.getByText(/^#[0-9a-f]{6}$/i).first()).toBeVisible();
}

test("/sistema carga y es accesible @critico", async ({ page }) => {
  await page.goto("/sistema");
  await expect(page).toHaveTitle("Sistema · PokeRadar Geoespacial");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await esperarColores(page);
  await esperarSinViolaciones(page);
});

test("/sistema no es indexable", async ({ page }) => {
  await page.goto("/sistema");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("/sistema se recorre con teclado", async ({ page }) => {
  await page.goto("/sistema");
  const total = await page.getByRole("button").count();
  expect(total).toBeGreaterThan(0);
  const colorFoco = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-texto").trim(),
  );
  // Compare through a probe so hex and rgb() forms normalize to the same string
  const esperado = await page.evaluate((valor) => {
    const sonda = document.createElement("span");
    sonda.style.color = valor;
    document.body.append(sonda);
    const color = getComputedStyle(sonda).color;
    sonda.remove();
    return color;
  }, colorFoco);
  const visitados = new Set<string>();
  for (let i = 0; i < total + 5 && visitados.size < total; i++) {
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el.tagName !== "BUTTON") return null;
      const s = getComputedStyle(el);
      return {
        texto: el.textContent ?? "",
        contorno: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
        sombra: s.boxShadow !== "none",
      };
    });
    if (!foco) continue;
    expect(foco.contorno || foco.sombra, `sin foco visible en "${foco.texto}"`).toBe(true);
    // Retries because the outline color transitions in over --duracion-rapida
    await expect(page.locator(":focus"), `anillo de foco ajeno al sistema en "${foco.texto}"`).toHaveCSS(
      "outline-color",
      esperado,
    );
    visitados.add(foco.texto);
  }
  expect(visitados.size).toBe(total);
});

test("/sistema no salta al cargar fuentes", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        const salto = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!salto.hadRecentInput) w.__cls += salto.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/sistema");
  await page.evaluate(() => document.fonts.ready);
  await esperarColores(page);
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.01);
});

test("/sistema respeta movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sistema");
  const duracion = await page
    .getByRole("button", { name: "Guardar" })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duracion).toBe("0s");
});

test("/sistema no cambió de aspecto @visual", async ({ page }) => {
  await page.goto("/sistema");
  await page.evaluate(() => document.fonts.ready);
  await esperarColores(page);
  await capturar(page, "sistema");
});

test("/sistema no desborda a lo ancho", async ({ page }) => {
  for (const ancho of [360, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/sistema");
    await esperarColores(page);
    const { scroll, interior } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      interior: window.innerWidth,
    }));
    expect(scroll, `desborde a ${ancho} px`).toBeLessThanOrEqual(interior);
  }
});
