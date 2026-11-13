import { test } from "@playwright/test";

// Diagnostic only: never fails, its output decides which projects run WebGL2 tests
test("webgl2 disponible @critico", async ({ page }, testInfo) => {
  await page.goto("/");
  const { webgl2, motor } = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return { webgl2: false, motor: "n/d" };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const motor = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    return { webgl2: true, motor };
  });
  const resultado = { proyecto: testInfo.project.name, webgl2, motor };
  const cuerpo = JSON.stringify(resultado);
  await testInfo.attach("webgl2", { body: cuerpo, contentType: "application/json" });
  console.log(`webgl2 ${cuerpo}`);
});
