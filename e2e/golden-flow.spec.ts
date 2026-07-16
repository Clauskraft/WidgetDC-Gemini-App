import { expect, test } from "@playwright/test";

/**
 * GF-PR2 golden-flow contract: demand → answer streams → ONE calm intelligence
 * strip shows live routing + sources and expands to detail. /api/chat is
 * stubbed with a UI-message-stream fixture (runs without platform keys); the
 * server half (parallel enrichment emission) is unit-tested in
 * -api.chat.enrichment.test.ts.
 */

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

const STREAM_FIXTURE = [
  sse({ type: "start", messageId: "m1" }),
  sse({ type: "start-step" }),
  sse({ type: "text-start", id: "t1" }),
  sse({ type: "text-delta", id: "t1", delta: "WidgeTDC ruter dit demand gennem platformen. " }),
  sse({
    type: "data-reasoning",
    id: "reasoning",
    data: {
      intentTool: "kg_rag.query",
      intentScore: 0.82,
      intentCandidates: ["kg_rag.query", "srag.query", "graph.read_cypher"],
    },
  }),
  sse({ type: "text-delta", id: "t1", delta: "Svaret er groundet i grafen [1]." }),
  sse({
    type: "data-sources",
    id: "sources",
    data: {
      sources: [
        { text: "Intelligence stack dokumentation", source: "vidensarkiv:stack.md", score: 0.91 },
        { text: "kg_rag hybrid retrieval", source: "graph:kg_rag", score: 0.84 },
      ],
    },
  }),
  sse({ type: "text-end", id: "t1" }),
  sse({ type: "end-step" }),
  sse({ type: "end", finishReason: "stop" }),
].join("");

test("demand → answer → one intelligence strip with live routing, expandable to detail", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: STREAM_FIXTURE,
    }),
  );

  await page.goto("/");
  // Interact only after client hydration (RootComponent stamps the marker) —
  // a pre-hydration Enter is silently lost.
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  // Two user actions total: type + Enter (P0).
  await page.locator("textarea").first().fill("Forklar intelligence stack");
  await page.keyboard.press("Enter");

  // The answer streams.
  await expect(page.getByText("ruter dit demand gennem platformen")).toBeVisible({
    timeout: 20000,
  });

  // Exactly ONE status surface, fed by real parts.
  const strip = page.getByTestId("intelligence-strip");
  await expect(strip).toHaveCount(1);
  await expect(strip).toContainText("routing to kg_rag.query");
  await expect(strip).toContainText("0.82");
  await expect(strip).toContainText("2 sources");

  // Expands to routing candidates.
  await strip.locator("button").first().click();
  await expect(strip).toContainText("Routing");
  await expect(strip).toContainText("srag.query");
  await expect(strip).toContainText("graph.read_cypher");

  // Legacy per-message reasoning panel is gone (P1: one surface only).
  await expect(page.getByText("Reasoning &")).toHaveCount(0);
});
