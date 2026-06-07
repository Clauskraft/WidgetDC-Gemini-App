import { expect, test } from "@playwright/test";

/**
 * Visuelle regression-snapshots for graf-renderingen.
 * Harness: src/routes/visual.graph.tsx → /visual/graph?case=<id>&fs=<0|1>
 *
 * Hver case snapshottes både i normal og fuldskærms-layout. Baselines ligger
 * ved siden af denne fil i graph.spec.ts-snapshots/.
 */

const CASES = ["linear", "branching", "knowledge", "invalid"] as const;

for (const caseId of CASES) {
  test.describe(`graph case: ${caseId}`, () => {
    test(`normal layout — ${caseId}`, async ({ page }) => {
      await page.goto(`/visual/graph?case=${caseId}`);
      const stage = page.getByTestId("visual-stage");
      await stage.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.documentElement.dataset.visualHarness === "ready");
      // Stille tråden: vent på at evt. fonts/SVG defs er på plads.
      await page.evaluate(() => document.fonts?.ready);
      await expect(stage).toHaveScreenshot(`graph-${caseId}-normal.png`, {
        animations: "disabled",
      });
    });

    test(`fullscreen layout — ${caseId}`, async ({ page }) => {
      await page.goto(`/visual/graph?case=${caseId}&fs=1`);
      const stage = page.getByTestId("visual-fullscreen");
      await stage.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.documentElement.dataset.visualHarness === "ready");
      await page.evaluate(() => document.fonts?.ready);
      await expect(stage).toHaveScreenshot(`graph-${caseId}-fullscreen.png`, {
        animations: "disabled",
      });
    });
  });
}
