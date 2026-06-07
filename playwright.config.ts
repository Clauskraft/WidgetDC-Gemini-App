import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright visual snapshot config for MermaidFigure.
 * Kører en isoleret harness-route (/__visual/mermaid) i desktop-viewport
 * og snapshotter både normal- og fuldskærms-render.
 */
const PORT = Number(process.env.PW_PORT ?? 4173);
const BASE_URL = process.env.PW_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    toHaveScreenshot: {
      // små anti-aliasing forskelle mellem mermaid-versioner må ikke fælde testen
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : {
        command: `bun run build && bun run preview --port ${PORT} --host 127.0.0.1`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
