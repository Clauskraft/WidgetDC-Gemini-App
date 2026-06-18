import { expect, test, type Page } from "@playwright/test";

async function fillBrief(page: Page, text: string) {
  const brief = page.getByPlaceholder(/Beskriv hvad deliverablen/i);
  await brief.click();
  await brief.fill(text);
  await expect(brief).toHaveValue(text);
  await expect(page.getByRole("button", { name: /Generér deliverable/i })).toBeEnabled();
}

/**
 * Deliverable Studio (Phase 1). Stubs /api/deliverable/generate so the test runs
 * without platform keys, verifying the page wires the request, renders the
 * returned markdown, and surfaces the PRISM quality badge.
 */
test("deliverable studio generates and renders a deliverable with PRISM badge", async ({
  page,
}) => {
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
  await page.waitForLoadState("networkidle");

  await fillBrief(
    page,
    "Analyser hvordan en chat-frontend bør eksponere en knowledge-graph-platform.",
  );
  await page.getByRole("button", { name: /Generér deliverable/i }).click();

  // Rendered markdown heading + the PRISM quality badge from the stubbed response.
  await expect(page.getByRole("heading", { name: "Test Deliverable" })).toBeVisible();
  await expect(page.getByText(/PRISM 8\.5\/10/)).toBeVisible();
  await expect(page.getByText(/3 citationer/)).toBeVisible();
});

test("deliverable studio surfaces degraded fallback outputs", async ({ page }) => {
  await page.route("**/api/deliverable/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "X-WidgeTDC-Degraded": "true",
        "X-WidgeTDC-Fallback-Reason": "platform_pipeline_unavailable",
        "X-WidgeTDC-Fallback-Source": "writer_fallback",
      },
      body: JSON.stringify({
        markdown: "# Safe Mode Deliverable\n\nProduced body with an explicit fallback marker.",
        citations: 0,
        kind: "analysis",
        engine: "rag",
        source: "writer_fallback",
        degraded: true,
        fallbackReason: "platform_pipeline_unavailable",
        fallbackSource: "writer_fallback",
        correlationId: "test-correlation-id",
        quality: null,
      }),
    });
  });

  await page.goto("/deliverable");
  await page.waitForLoadState("networkidle");

  await fillBrief(page, "Analyser governance for fallback-genererede deliverables.");
  await page.getByRole("button", { name: /Generér deliverable/i }).click();

  await expect(page.getByRole("heading", { name: "Safe Mode Deliverable" })).toBeVisible();
  await expect(page.getByText("Safe-mode output")).toBeVisible();
  await expect(page.getByText(/platform_pipeline_unavailable/)).toBeVisible();
  await expect(page.getByText(/test-correlation-id/)).toBeVisible();
});
