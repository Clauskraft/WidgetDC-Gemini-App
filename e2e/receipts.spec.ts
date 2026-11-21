import { expect, test } from "@playwright/test";

/**
 * GF-PR4: UI receipts feed the adoption flywheel. User-initiated interactions
 * (strip expand, explicit canvas open) POST whitelisted payloads to
 * /api/receipts; system-initiated auto-open must NOT emit (R24 honesty).
 *
 * Fixtures speak the ai@6 UI-message-stream protocol (finish-step/finish).
 */

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

// Prose answer WITH enrichment (routing tool) but NO structured blocks: the
// canvas stays closed, the strip shows routing detail to expand.
const ENRICHED_PROSE_STREAM = [
  sse({ type: "start", messageId: "m1" }),
  sse({ type: "start-step" }),
  sse({ type: "text-start", id: "t1" }),
  sse({ type: "text-delta", id: "t1", delta: "WidgeTDC ruter dit demand gennem platformen." }),
  sse({
    type: "data-reasoning",
    id: "reasoning",
    data: {
      intentTool: "kg_rag.query",
      intentScore: 0.82,
      intentCandidates: ["kg_rag.query", "srag.query"],
    },
  }),
  sse({ type: "text-end", id: "t1" }),
  sse({ type: "finish-step" }),
  sse({ type: "finish" }),
].join("");

test("strip expand emits a whitelisted fold_out receipt", async ({ page }) => {
  const receipts: unknown[] = [];
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: ENRICHED_PROSE_STREAM,
    }),
  );
  await page.route("**/api/receipts", (route) => {
    receipts.push(route.request().postDataJSON());
    return route.fulfill({
      status: 202,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    });
  });

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("Forklar intelligence stack");
  await page.keyboard.press("Enter");

  const strip = page.getByTestId("intelligence-strip");
  await expect(strip).toContainText("Rute", { timeout: 20000 });
  await expect(strip).not.toContainText("Evidens");
  await expect(strip).not.toContainText("kg_rag.query");

  // No receipts before the user pulls anything open.
  expect(receipts).toHaveLength(0);

  await strip.locator("button").first().click();
  await expect(strip).toContainText("Rute");
  await expect(strip).toContainText("kg_rag.query");

  await expect.poll(() => receipts.length, { timeout: 5000 }).toBe(1);
  expect(receipts[0]).toMatchObject({
    interaction: "fold_out",
    producing_tool: "kg_rag.query",
  });
  expect(String((receipts[0] as { entity_id: string }).entity_id)).toMatch(/^strip\//);

  // Collapse + re-expand inside the debounce window does not double-emit.
  await strip.locator("button").first().click();
  await strip.locator("button").first().click();
  await page.waitForTimeout(300);
  expect(receipts).toHaveLength(1);
});

// Graph answer WITHOUT enrichment: the canvas auto-opens (structured block)
// and the inspector's Drill is the card_drilldown surface (GF-PR5).
const GRAPH_STREAM = [
  sse({ type: "start", messageId: "m1" }),
  sse({ type: "start-step" }),
  sse({ type: "text-start", id: "t1" }),
  sse({ type: "text-delta", id: "t1", delta: "Grafen:\n" }),
  sse({
    type: "text-delta",
    id: "t1",
    delta:
      '```graph\n{"nodes":[{"id":"pattern-17","label":"Pattern 17"},{"id":"tool-3","label":"Tool 3"}],"edges":[{"source":"pattern-17","target":"tool-3"}]}\n```\n',
  }),
  sse({ type: "text-end", id: "t1" }),
  sse({ type: "finish-step" }),
  sse({ type: "finish" }),
].join("");

test("GF-PR5: Drill on a canvas graph node emits a card_drilldown receipt", async ({ page }) => {
  const receipts: unknown[] = [];
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: GRAPH_STREAM,
    }),
  );
  await page.route("**/api/receipts", (route) => {
    receipts.push(route.request().postDataJSON());
    return route.fulfill({
      status: 202,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    });
  });

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.appHydrated === "true");
  await page.locator("textarea").first().fill("vis mønster-grafen");
  await page.keyboard.press("Enter");

  // Canvas auto-opens on the structured answer (system-initiated: NO receipt).
  const drawer = page.getByTestId("canvas-drawer");
  await drawer.waitFor({ state: "visible", timeout: 30000 });
  expect(receipts).toHaveLength(0);

  // GraphCanvas pre-selects the first node; Drill in the drawer's inspector.
  await drawer.getByRole("button", { name: "Drill" }).click();

  await expect.poll(() => receipts.length, { timeout: 5000 }).toBe(1);
  expect(receipts[0]).toMatchObject({
    interaction: "card_drilldown",
    producing_tool: "graph.read_cypher",
    entity_id: "graph-node/pattern-17",
  });
});
