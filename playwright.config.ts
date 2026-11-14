import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
// Release runs exercise every project fully; otherwise non-chromium projects only run @critical
const full = process.env.E2E_FULL === "1";
// Captures (@visual) exist only for chromium, so other projects never run them
const criticalOnly = full
  ? { grepInvert: /@visual/ }
  : { grep: /@critical/, grepInvert: /@visual/ };
// Own port so a running `pnpm dev` on 3000 is never reused; E2E_PORT keeps parallel worktrees from
// reusing each other's server
const port = Number(process.env.E2E_PORT) || 3100;
// The PokéAPI fixtures sit next to the app's port, so parallel worktrees do not share them either
const pokeApiPort = port + 1;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: isCI,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  // CI never creates missing baselines, so a missing one fails the run
  updateSnapshots: isCI ? "none" : "missing",
  // Platform in the path: font rendering differs, only the Linux base is versioned
  snapshotPathTemplate: "e2e/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: [
    {
      // PokéAPI fixtures: no test reaches the real service
      command: "node e2e/fixtures/pokeapi-server.mjs",
      url: `http://localhost:${pokeApiPort}/health`,
      env: { PORT: String(pokeApiPort) },
      reuseExistingServer: !isCI,
    },
    {
      // CI builds once in its own step
      command: isCI ? `pnpm start -p ${port}` : `pnpm build && pnpm start -p ${port}`,
      port,
      // Read at request time, so the same build serves real data elsewhere
      env: { POKEAPI_BASE_URL: `http://localhost:${pokeApiPort}` },
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", ...criticalOnly, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", ...criticalOnly, use: { ...devices["Desktop Safari"] } },
    { name: "android", ...criticalOnly, use: { ...devices["Pixel 7"] } },
    { name: "iphone", ...criticalOnly, use: { ...devices["iPhone 15"] } },
  ],
});
