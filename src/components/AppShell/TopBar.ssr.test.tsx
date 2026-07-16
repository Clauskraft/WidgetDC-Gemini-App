import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopBarView } from "./TopBar";

describe("TopBarView (GF-PR1 — one header for the whole app)", () => {
  it("renders as a banner landmark with the current page title", () => {
    const html = renderToString(<TopBarView title="Graph" />);
    expect(html).toContain('role="banner"');
    expect(html).toContain("Graph");
    expect(html).toContain('data-testid="top-bar"');
  });

  it("canvas toggle is a visibly disabled control until the unified canvas ships (no dead click)", () => {
    const html = renderToString(<TopBarView title="Chat" />);
    expect(html).toContain('data-testid="canvas-toggle"');
    expect(html).toContain("disabled");
    expect(html).toContain("Opens with structured answers");
  });

  it("exposes the command palette trigger", () => {
    const html = renderToString(<TopBarView title="Chat" />);
    expect(html).toContain('data-testid="command-palette-trigger"');
    expect(html).toContain("⌘K");
  });
});
