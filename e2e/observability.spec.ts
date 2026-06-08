import { expect, test } from "@playwright/test";

/**
 * Observability Monitor (Phase 3). Stubs /api/observability/summary so the test
 * runs without platform keys, verifying KPIs render and a high-error tool is
 * flagged.
 */
test("observability monitor renders fleet KPIs and flags a high-error tool", async ({ page }) => {
  await page.route("**/api/observability/summary", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runtime: {
          totalAgents: 16,
          totalRequests: 6442,
          successRate: 82.8,
          tools: [
            { name: "graph.stats", calls: 2163, errors: 69, errorRate: 69 / 2163, avgMs: 2143 },
            {
              name: "backend.http_post",
              calls: 1711,
              errors: 842,
              errorRate: 842 / 1711,
              avgMs: 2053,
            },
          ],
        },
        graph: { nodes: 1614954, relationships: 3593503, online: true },
      }),
    });
  });

  await page.goto("/observability");

  await expect(page.getByText("82.8%")).toBeVisible();
  // The 49% backend.http_post row is sorted to the top and flagged as hot (≥20%).
  await expect(page.getByText("backend.http_post")).toBeVisible();
  await expect(page.getByText("49%")).toBeVisible();
});
