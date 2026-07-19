import { expect, test } from "@playwright/test";

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

function stream(messageId: string, text: string): string {
  return [
    sse({ type: "start", messageId }),
    sse({ type: "start-step" }),
    sse({ type: "text-start", id: `${messageId}-text` }),
    sse({ type: "text-delta", id: `${messageId}-text`, delta: text }),
    sse({ type: "text-end", id: `${messageId}-text` }),
    sse({ type: "finish-step" }),
    sse({ type: "finish" }),
  ].join("");
}

test("default Aurora repairs an invalid answer without an active gem", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postData() ?? "");
    const first = requests.length === 1;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: first
        ? stream("invalid", "Et svar uden den krævede canvas-struktur.")
        : stream(
            "repaired",
            "## Rettet svar\n\nSamme indhold.\n\nCanvas notes:\n- Første pointe\n- Anden pointe\n- Tredje pointe",
          ),
    });
  });

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Svar kort");
  await page.keyboard.press("Enter");

  await expect.poll(() => requests.length, { timeout: 20000 }).toBe(2);
  expect(requests[1]).toContain("Self-heal forsøg 1");
  await expect(page.getByText("Rettet svar")).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(/\/c\//);
  await expect(page.getByText(/dit forrige svar bestod ikke/)).toHaveCount(0);
  const persisted = await page.evaluate(() => localStorage.getItem("widgetdc.threads.v1"));
  expect(persisted).not.toContain("dit forrige svar bestod ikke");
});

test("failed default repair preserves the first answer and releases navigation", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/chat", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        body: stream("invalid", "Et svar uden den krævede canvas-struktur."),
      });
      return;
    }
    await route.fulfill({ status: 503, body: "repair unavailable" });
  });

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Svar kort");
  await page.keyboard.press("Enter");

  await expect.poll(() => requestCount, { timeout: 20000 }).toBe(2);
  await expect(page.getByText("Et svar uden den krævede canvas-struktur.")).toBeVisible();
  await expect(page).toHaveURL(/\/c\//, { timeout: 20000 });
  await expect(page.getByText(/dit forrige svar bestod ikke/)).toHaveCount(0);
  const persisted = await page.evaluate(() => localStorage.getItem("widgetdc.threads.v1"));
  expect(persisted).not.toContain("dit forrige svar bestod ikke");

  await page.reload();
  await expect(page.getByText("Et svar uden den krævede canvas-struktur.")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(requestCount).toBe(2);
});
