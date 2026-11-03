import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

const MALFORMED_DEFAULT = "Delvist svar med defekt flow.\n\n```flow\n{ invalid json }\n```";

test("default Aurora repairs malformed flow without an active gem", async ({ page }) => {
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
        ? stream("invalid", MALFORMED_DEFAULT)
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
        body: stream("invalid", MALFORMED_DEFAULT),
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
  await expect(page.getByText("Delvist svar med defekt flow.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/c\//, { timeout: 20000 });
  await expect(page.getByText(/dit forrige svar bestod ikke/)).toHaveCount(0);
  const persisted = await page.evaluate(() => localStorage.getItem("widgetdc.threads.v1"));
  expect(persisted).not.toContain("dit forrige svar bestod ikke");

  await page.reload();
  await expect(page.getByText("Delvist svar med defekt flow.", { exact: false })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(requestCount).toBe(2);
});


// The existing hosted E2E workflow runs this spec. Keep the route and validator
// contracts in that same CI path without adding a separate workflow.
test("row927 route and validator contracts run on the hosted runner", async () => {
  execFileSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)),
    "run",
    "src/lib/gemResponseValidator.test.ts",
    "src/routes/api/chat.test.ts",
    "--maxWorkers=1",
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "inherit",
    timeout: 120_000,
  });
});

async function holdChatStreamUntilAbort(page: Page, selectedRequest: number) {
  await page.addInitScript(({ selectedRequest }) => {
    const fetchOriginal = window.fetch.bind(window);
    let chatRequests = 0;
    window.fetch = async (input, init) => {
      const response = await fetchOriginal(input, init);
      const url = typeof input === "string"
        ? input
        : input instanceof Request ? input.url : input.toString();
      if (!url.endsWith("/api/chat") || ++chatRequests !== selectedRequest) return response;
      const body = await response.text();
      const end = body.indexOf('data: {"type":"text-end"');
      if (end < 0) throw new Error("Held chat response has no text-end boundary");
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      let finished = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body.slice(0, end)));
          const abort = () => {
            if (finished) return;
            finished = true;
            controller.error(new DOMException("Aborted by Stop", "AbortError"));
          };
          if (signal?.aborted) abort();
          else signal?.addEventListener("abort", abort, { once: true });
        },
        cancel() {
          finished = true;
        },
      });
      return new Response(stream, { status: response.status, headers: response.headers });
    };
  }, { selectedRequest });
}

test("row927 plain default reply stays one request and one visible answer", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/chat", async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: stream("plain-" + requests, "Et helt almindeligt kort svar."),
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Svar helt almindeligt");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/c\//, { timeout: 20000 });
  expect(requests).toBe(1);
  await expect(page.getByText("Et helt almindeligt kort svar.", { exact: true })).toHaveCount(1);
});

test("row927 Stop fences ready-on-abort and a genuine next turn is still allowed", async ({ page }) => {
  let requests = 0;
  await holdChatStreamUntilAbort(page, 1);
  await page.route("**/api/chat", async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: stream("cancel-" + requests, requests === 1 ? MALFORMED_DEFAULT : "Et nyt gyldigt svar."),
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Første spørgsmål");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Delvist svar med defekt flow.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toBe(1);
  await page.locator("textarea").first().fill("Nyt reelt spørgsmål");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Et nyt gyldigt svar.", { exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test("row927 Stop during an automatic repair prevents a further repair", async ({ page }) => {
  let requests = 0;
  await holdChatStreamUntilAbort(page, 2);
  await page.route("**/api/chat", async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: stream("repair-cancel-" + requests, MALFORMED_DEFAULT),
    });
  });
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Spørgsmål med defekt artefakt");
  await page.keyboard.press("Enter");
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByText("Delvist svar med defekt flow.", { exact: false })).toHaveCount(2);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toBe(2);
});
