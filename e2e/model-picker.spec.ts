import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await expect(page.getByText("Værktøjer", { exact: true })).toBeVisible();
  await expect(page.locator("textarea")).toBeVisible();
}

/**
 * Verificerer at den governede chat-shell er implementeret:
 * 1. ModelPicker er fjernet — ingen GPT-5/Gemini selector
 * 2. Avancerede modes er samlet bag Værktøjer
 * 3. Chat kald går gennem frontendens WDC CLI chat-adapter
 */

test("governed chat shell — no model picker, tools disclosure visible", async ({ page }) => {
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

  // Verify advanced controls remain available without permanent mode chrome.
  await expect(page.getByText("Værktøjer", { exact: true })).toBeVisible();
  await expect(page.getByText("WDC Chat", { exact: true })).toHaveCount(0);

  // Send a message and verify it goes through
  const reqPromise = page.waitForRequest(
    (req) => req.url().endsWith("/api/chat") && req.method() === "POST",
  );
  const input = page.locator("textarea");
  await input.click();
  await input.pressSequentially("Hej WDC Chat test");
  const sendButton = page.getByRole("button", { name: "Send" });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  const req = await reqPromise;
  const payload = req.postDataJSON() as { messages?: unknown };
  expect(Array.isArray(payload.messages)).toBe(true);
});
