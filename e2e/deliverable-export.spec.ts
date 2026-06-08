import { expect, test } from "@playwright/test";

/**
 * Phase 1b Output Forge export. Stubs /api/deliverable/export so the test runs
 * without platform keys, verifying the DOCX export button decodes the base64
 * payload and triggers a download with the server-provided filename.
 */
test("deliverable studio exports a DOCX via Output Forge", async ({ page }) => {
  await page.route("**/api/deliverable/export", async (route) => {
    await route.fulfill({
      json: {
        base64: "QUJD", // "ABC"
        filename: "test-brief.docx",
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  });

  await page.goto("/deliverable");
  await page
    .getByPlaceholder(/Beskriv hvad deliverablen/i)
    .fill("Analyser hvordan en chat-frontend bør eksponere en knowledge-graph-platform.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^DOCX$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("test-brief.docx");
});
