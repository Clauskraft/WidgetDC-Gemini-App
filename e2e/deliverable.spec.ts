import { expect, test } from "@playwright/test";

/**
 * Deliverable Studio (Phase 1). Stubs /api/deliverable/generate so the test runs
 * without platform keys, verifying the page wires the request, renders the
 * returned markdown, and surfaces the PRISM quality badge.
 */
test("deliverable studio generates and renders a deliverable with PRISM badge", async ({ page }) => {
  await page.route("**/api/deliverable/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        markdown: "# Test Deliverable\n\nProduced body with a key point.",
        citations: 3,
        kind: "analysis",
        quality: { score: 8.5, dimensions: { precision: 9 } },
      }),
    });
  });

  await page.goto("/deliverable");

  await page
    .getByPlaceholder(/Beskriv hvad deliverablen/i)
    .fill("Analyser hvordan en chat-frontend bør eksponere en knowledge-graph-platform.");
  await page.getByRole("button", { name: /Generér deliverable/i }).click();

  // Rendered markdown heading + the PRISM quality badge from the stubbed response.
  await expect(page.getByRole("heading", { name: "Test Deliverable" })).toBeVisible();
  await expect(page.getByText(/PRISM 8\.5\/10/)).toBeVisible();
  await expect(page.getByText(/3 citationer/)).toBeVisible();
});
