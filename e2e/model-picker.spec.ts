import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
}

/**
 * Verificerer kontrakten omkring model-pickeren:
 * 1. Når man vælger en model og sender en besked, indeholder POST /api/chat
 *    `body.model` med det valgte model-id.
 * 2. Dashboardet ("Aktiv model" metric) afspejler det samme valg efterfølgende.
 *
 * /api/chat stubbes så testen kører uden LOVABLE_API_KEY og uden ægte LLM-kald.
 */

const TARGET_MODEL_ID = "google/gemini-2.5-pro";
const TARGET_MODEL_LABEL = "Gemini 2.5 Pro";

test("model-picker sender body.model og dashboardet viser valget", async ({ page }) => {
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

  // Åbn pickeren i chat-headeren og vælg target-modellen.
  const picker = page.getByRole("button", { name: /Gemini|GPT/i }).first();
  await expect(picker).toBeVisible();
  await picker.click();
  const target = page.getByRole("menuitem", { name: new RegExp(TARGET_MODEL_LABEL, "i") });
  await expect(target).toBeVisible();
  await target.click();

  // Triggeren skal nu vise det nye label.
  await expect(
    page.getByRole("button", { name: new RegExp(TARGET_MODEL_LABEL, "i") }).first(),
  ).toBeVisible();

  // Send en besked og fang request body parallelt.
  const reqPromise = page.waitForRequest(
    (req) => req.url().endsWith("/api/chat") && req.method() === "POST",
  );
  await page.locator("textarea").fill("Hej model-test");
  await page.locator("textarea").press("Enter");

  const req = await reqPromise;
  const payload = req.postDataJSON() as { model?: string; messages?: unknown };
  expect(payload.model).toBe(TARGET_MODEL_ID);
  expect(Array.isArray(payload.messages)).toBe(true);

  // Navigér til dashboard og verificér at "Aktiv model" viser det samme label.
  await page.goto("/dashboard");
  const metric = page.getByText("Aktiv model").locator("..");
  await expect(metric).toContainText(TARGET_MODEL_LABEL);
});
