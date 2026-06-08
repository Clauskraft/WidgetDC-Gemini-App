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
        // This project pins nitro `preset: "node-server"`, so the build emits a
        // standalone server entry at `index.mjs` (the `start` script). `vite
        // preview` is incompatible with that layout — its preview-server plugin
        // imports `dist/server/server.js`, which the node-server preset never
        // produces — so boot the nitro output directly. The output dir is either
        // `.output/server` or `dist/server` depending on the build's sandbox
        // detection, so pick whichever entry exists.
        command: `bun run build && PORT=${PORT} HOST=127.0.0.1 node "$([ -f .output/server/index.mjs ] && echo .output/server/index.mjs || echo dist/server/index.mjs)"`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
