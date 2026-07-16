import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasProvider, useCanvas } from "./canvas-context";

function Probe() {
  const canvas = useCanvas();
  return (
    <div>
      <span data-open={canvas.open} />
      <span data-user-closed={canvas.userClosedThisThread} />
    </div>
  );
}

/**
 * GF-PR3: CanvasProvider is the route-agnostic canvas state (mounted in
 * __root). Chat publishes messages into it; the TopBar toggle and the drawer
 * both consume it. SSR renders closed by default and never throws.
 */
describe("canvas-context", () => {
  it("SSR-safe defaults: closed, not user-closed", () => {
    const html = renderToString(
      <CanvasProvider>
        <Probe />
      </CanvasProvider>,
    );
    expect(html).toContain('data-open="false"');
    expect(html).toContain('data-user-closed="false"');
  });

  it("useCanvas outside a provider fails loudly (wiring bug, not silent no-op)", () => {
    expect(() => renderToString(<Probe />)).toThrow(/CanvasProvider/);
  });
});
