import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { getWorkMode } from "@/lib/workModes";

describe("CanvasWorkspace", () => {
  it("server-renders object palette, canvas persistence and inspector", () => {
    const html = renderToString(
      <CanvasWorkspace mode={getWorkMode("operate")} onCopyPrompt={() => undefined} />,
    );

    expect(html).toContain("Object palette");
    expect(html).toContain("Session");
    expect(html).toContain("A2A message");
    expect(html).toContain("Proof gate");
    expect(html).toContain("Canvas persistence");
    expect(html).toContain("Object inspector");
    expect(html).toContain("local-thread-bound");
  });
});
