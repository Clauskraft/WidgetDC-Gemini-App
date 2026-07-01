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
});
