import type { UIMessage } from "ai";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasDrawerView, latestStructuredMessage } from "./CanvasDrawer";

const msg = (id: string, text: string): UIMessage =>
  ({ id, role: "assistant", parts: [{ type: "text", text }] }) as UIMessage;

const MERMAID_MSG = msg("m2", "Processen:\n```mermaid\ngraph TD; A-->B;\n```\nFærdig.");

/**
 * GF-PR3: ONE canvas. The drawer renders the focused message through the SAME
 * MessageContent pipeline as the chat — mermaid becomes SVG (the old
 * CanvasPanel stripped fences and showed raw code with a "render with
 * Mermaid.js" caption; that bug dies here).
 */
describe("CanvasDrawer", () => {
  it("renders the focused message via MessageContent — no raw-mermaid fallback caption", () => {
    const html = renderToString(
      <CanvasDrawerView
        messages={[msg("m1", "prosa"), MERMAID_MSG]}
        focusedMessageId={null}
        onClose={() => {}}
        onFocusMessage={() => {}}
      />,
    );
    expect(html).toContain('data-testid="canvas-drawer"');
    expect(html).not.toContain("render with Mermaid.js");
    expect(html).not.toContain("Aurora · auto-layout");
    // MermaidBlock container is in the tree (SVG renders client-side).
    expect(html).toMatch(/mermaid/i);
  });

  it("pages between structured messages and shows position n/m", () => {
    const another = msg("m4", "```flow\nA -> B\n```");
    const html = renderToString(
      <CanvasDrawerView
        messages={[MERMAID_MSG, msg("m3", "prosa"), another]}
        focusedMessageId={null}
        onClose={() => {}}
        onFocusMessage={() => {}}
      />,
    );
    // Two structured messages; focused defaults to the latest (2/2).
    // (SSR interleaves comment nodes between text children.)
    expect(html).toMatch(/2(<!-- -->)?\/(<!-- -->)?2/);
  });

  it("latestStructuredMessage picks the newest message with figure blocks", () => {
    const latest = latestStructuredMessage([MERMAID_MSG, msg("m5", "bare tekst")]);
    expect(latest?.id).toBe("m2");
    expect(latestStructuredMessage([msg("m6", "tekst")])).toBeNull();
  });

  it("empty state is honest when no structured answer exists yet", () => {
    const html = renderToString(
      <CanvasDrawerView
        messages={[msg("m1", "kun prosa")]}
        focusedMessageId={null}
        onClose={() => {}}
        onFocusMessage={() => {}}
      />,
    );
    expect(html).toContain("Canvas åbner");
  });
});
