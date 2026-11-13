import { defineConfig, devices } from "@playwright/test";

const enCI = Boolean(process.env.CI);
// Release runs exercise every project fully; otherwise non-chromium projects only run @critico
const completo = process.env.E2E_COMPLETO === "1";
// Captures (@visual) exist only for chromium, so other projects never run them
const soloCritico = completo
  ? { grepInvert: /@visual/ }
  : { grep: /@critico/, grepInvert: /@visual/ };
// Own port so a running `pnpm dev` on 3000 is never reused
const puerto = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: enCI,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  // CI never creates missing baselines, so a missing one fails the run
  updateSnapshots: enCI ? "none" : "missing",
  // Platform in the path: font rendering differs, only the Linux base is versioned
  snapshotPathTemplate: "e2e/__capturas__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: `http://localhost:${puerto}`,
  },
  webServer: {
    // CI builds once in its own step
    command: enCI ? `pnpm start -p ${puerto}` : `pnpm build && pnpm start -p ${puerto}`,
    port: puerto,
    reuseExistingServer: !enCI,
    timeout: 300_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", ...soloCritico, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", ...soloCritico, use: { ...devices["Desktop Safari"] } },
    { name: "android", ...soloCritico, use: { ...devices["Pixel 7"] } },
    { name: "iphone", ...soloCritico, use: { ...devices["iPhone 15"] } },
  ],
});
