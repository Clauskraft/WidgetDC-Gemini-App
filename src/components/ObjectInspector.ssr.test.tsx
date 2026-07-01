import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ObjectInspector } from "@/components/ObjectInspector";
import { createCanvasWorkspaceDocument } from "@/lib/canvasWorkspace";
import { WORK_MODES } from "@/lib/workModes";

describe("ObjectInspector", () => {
  it("renders selected object details and proof boundary", () => {
    const document = createCanvasWorkspaceDocument(WORK_MODES[0]);
    const object = document.objects[0];
    const html = renderToString(<ObjectInspector object={object} document={document} />);

    expect(html).toContain("Object inspector");
    expect(html).toContain(object.title);
    expect(html).toContain(object.type);
    expect(html).toContain(object.proofBoundary);
    expect(html).toContain(document.persistence.kind);
  });

  it("renders generic capability cockpit objects with metadata and next safe action", () => {
    const html = renderToString(
      <ObjectInspector
        item={{
          title: "Runtime Truth",
          type: "pattern",
          summary: "Verify claims through live readback.",
          proofBoundary: "Candidate/projection only.",
          nextAction: "Dry-run through WDC Agent Office.",
          meta: [
            { label: "repo", value: "WidgeTDC" },
            { label: "mapped", value: "graph_readback_only" },
          ],
          sections: [
            { label: "requires", value: "proof.boundary" },
            { label: "cost", value: "provider executions=0" },
          ],
        }}
      />,
    );

    expect(html).toContain("Runtime Truth");
    expect(html).toContain("pattern");
    expect(html).toContain("Candidate/projection only.");
    expect(html).toContain("Next safe action");
    expect(html).toContain("graph_readback_only");
    expect(html).toContain("provider executions=0");
  });
});
