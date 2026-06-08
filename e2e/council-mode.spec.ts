import { expect, test } from "@playwright/test";

/**
 * Phase 4 Council (Mixture-of-Agents) mode. Stubs /api/chat so the test runs
 * without platform keys, verifying the Council toggle sends `body.council=true`
 * and is mutually exclusive with Deep.
 */
test("council toggle sends body.council and is exclusive with deep", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: "data: [DONE]\n\n",
    });
  });

  await page.goto("/");

  // Enabling Deep first, then Council, must leave only Council active.
  await page.getByRole("button", { name: /^Deep$/ }).click();
  const council = page.getByRole("button", { name: /^Council$/ });
  await council.click();
  await expect(council).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Deep$/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  const reqPromise = page.waitForRequest(
    (req) => req.url().endsWith("/api/chat") && req.method() === "POST",
  );
  await page.locator("textarea").fill("Council-test besked");
  await page.locator("textarea").press("Enter");

  const req = await reqPromise;
  const payload = req.postDataJSON() as { council?: boolean; deep?: boolean };
  expect(payload.council).toBe(true);
  expect(payload.deep).toBe(false);
});
