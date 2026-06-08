import { expect, test } from "@playwright/test";

/**
 * Phase 2 interactive graph drill-down. Stubs /api/graph/query (branching on the
 * request) so the test runs without platform keys: the base view returns a graph
 * whose first node is auto-selected, then "Drill" issues a node-neighbors request
 * and the breadcrumb + expanded neighbors render.
 */
test("graph explorer drills into a node and shows a breadcrumb", async ({ page }) => {
  await page.route("**/api/graph/query", async (route) => {
    const body = route.request().postDataJSON() as { query?: string; nodeId?: number };
    if (body.query === "node-neighbors") {
      await route.fulfill({
        json: {
          kind: "graph",
          spec: {
            caption: "Naboer til Alpha",
            nodes: [
              { id: "n1", label: "Alpha", type: "agent" },
              { id: "n2", label: "Beta", type: "entity" },
            ],
            edges: [{ source: "n1", target: "n2", label: "USES" }],
          },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        kind: "graph",
        spec: {
          caption: "Sample subgraph",
          nodes: [
            { id: "n1", label: "Alpha", type: "agent" },
            { id: "n42", label: "Gamma", type: "tool" },
          ],
          edges: [{ source: "n1", target: "n42", label: "CALLS" }],
        },
      },
    });
  });

  await page.goto("/graph");

  // First node auto-selects → inspector "Drill" button is available.
  await page.getByRole("button", { name: /^Drill$/ }).click();

  // Drilled view caption + new neighbor node render, and the breadcrumb shows the path.
  await expect(page.getByText("Naboer til Alpha")).toBeVisible();
  await expect(page.getByText("Beta")).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "Drill-sti" });
  await expect(crumbs.getByText("Alpha")).toBeVisible();
});
