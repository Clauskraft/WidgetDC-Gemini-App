import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
}

async function openTools(page: import("@playwright/test").Page) {
  await page.getByText("Værktøjer", { exact: true }).click();
}

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
  await waitForHydration(page);
  await openTools(page);

  // Enabling Deep first, then Council, must leave only Council active.
  const deep = page.getByRole("button", { name: "Dyb analyse" });
  await deep.click();
  await expect(deep).toHaveAttribute("aria-pressed", "true");
  const council = page.getByRole("button", { name: "Agentpanel" });
  await council.click();
  await expect(council).toHaveAttribute("aria-pressed", "true");
  await expect(deep).toHaveAttribute("aria-pressed", "false");

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

test("with both flags stored, only Council is active on load (Council wins)", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("widgetdc.chat.deep", "1");
    localStorage.setItem("widgetdc.chat.council", "1");
  });
  await page.goto("/");
  await waitForHydration(page);
  await openTools(page);
  await expect(page.getByRole("button", { name: "Agentpanel" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Dyb analyse" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
