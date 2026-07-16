import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

describe("PageShell (GF-PR1 — one frame for every content page)", () => {
  it("renders title, subtitle and children inside a single scrollable content region", () => {
    const html = renderToString(
      <PageShell title="Graph" subtitle="Live read-only Neo4j view">
        <div>page body</div>
      </PageShell>,
    );
    expect(html).toContain("Graph");
    expect(html).toContain("Live read-only Neo4j view");
    expect(html).toContain("page body");
    expect(html).toContain('data-testid="page-shell"');
  });

  it("never brings its own full-screen theme — the AppShell owns background and grid", () => {
    const html = renderToString(
      <PageShell title="Adoption">
        <div>body</div>
      </PageShell>,
    );
    expect(html).not.toContain("min-h-screen");
    expect(html).not.toContain("bg-zinc-900");
    // Root frame is a plain scroll container — no page-level theme classes.
    // (PageHeader's small icon chip may use accent classes; that is not a page theme.)
    expect(
      html.startsWith('<div data-testid="page-shell" class="flex-1 min-w-0 overflow-y-auto"'),
    ).toBe(true);
  });

  it("supports an optional preview banner for demo-data pages", () => {
    const html = renderToString(
      <PageShell
        title="Capabilities"
        previewNotice="Preview — deterministic demo data, not live platform state"
      >
        <div>body</div>
      </PageShell>,
    );
    expect(html).toContain("Preview — deterministic demo data");
  });
});
