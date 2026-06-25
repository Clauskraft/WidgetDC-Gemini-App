import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
}

/**
 * Verificerer at WDC Chat ONLY er implementeret:
 * 1. ModelPicker er fjernet — ingen GPT-5/Gemini selector
 * 2. "WDC Chat" badge vises istedet
 * 3. Chat kald går gennem WDC intent-gateway
 */

test("WDC Chat ONLY — no model picker, WDC Chat badge visible", async ({ page }) => {
  // Stub chat-endpointet: returnér en tom UI-message stream så useChat ikke fejler.
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: "data: [DONE]\n\n",
    });
  });

  await page.goto("/");
  await waitForHydration(page);

  // Verify ModelPicker is NOT present
  const modelPicker = page.getByRole("button", { name: /Gemini|GPT|Model/i }).first();
  await expect(modelPicker).not.toBeVisible();

  // Verify WDC Chat badge IS present
  const wdcBadge = page.getByRole("button", { name: /WDC Chat/i }).first();
  await expect(wdcBadge).toBeVisible();

  // Send a message and verify it goes through
  await page.locator("textarea").fill("Hej WDC Chat test");
  await page.locator("textarea").press("Enter");

  // Verify the request was made
  const reqPromise = page.waitForRequest(
    (req) => req.url().endsWith("/api/chat") && req.method() === "POST",
  );
  const req = await reqPromise;
  const payload = req.postDataJSON() as { messages?: unknown };
  expect(Array.isArray(payload.messages)).toBe(true);
});
