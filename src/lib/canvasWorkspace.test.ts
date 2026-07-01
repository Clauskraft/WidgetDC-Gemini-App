import { describe, expect, it } from "vitest";
import {
  CANVAS_MODES,
  CANVAS_OBJECT_TYPES,
  createCanvasObjectFromPalette,
  createCanvasWorkspaceDocument,
  resolveCanvasPalette,
} from "./canvasWorkspace";
import { getWorkMode } from "./workModes";

describe("canvasWorkspace", () => {
  it("defines the required object and canvas mode vocabulary", () => {
    expect(CANVAS_OBJECT_TYPES).toEqual(
      expect.arrayContaining([
        "Work item",
        "BOM item",
        "Route step",
        "Capability",
        "Gap",
        "Agent",
        "Claim",
        "Evidence",
        "Source",
        "Decision",
        "Risk",
        "Component",
        "PR",
        "Session",
        "A2A message",
        "Timeline event",
        "Chapter",
        "Entity",
      ]),
    );
    expect(CANVAS_MODES).toEqual(
      expect.arrayContaining([
        "Board",
        "Graph",
        "Timeline",
        "Outline",
        "Evidence Wall",
        "System Map",
      ]),
    );
  });

  it("creates mode-specific documents with local staged persistence boundaries", () => {
    const document = createCanvasWorkspaceDocument(getWorkMode("investigation"));

    expect(document.modeId).toBe("investigation");
    expect(document.canvasMode).toBe("Evidence Wall");
    expect(document.objects.map((object) => object.type)).toEqual(
      expect.arrayContaining(["Risk", "Source", "Entity", "Evidence"]),
    );
    expect(document.persistence.kind).toBe("local-thread-bound");
    expect(document.persistence.staged).toBe(true);
    expect(document.persistence.proofBoundary).toContain("not graph persistence");
  });

  it("uses the active work mode palette to create new canvas objects", () => {
    const mode = getWorkMode("book");
    const document = createCanvasWorkspaceDocument(mode);

    expect(resolveCanvasPalette(mode)).toEqual(["Chapter", "Entity", "Source", "Decision"]);

    const object = createCanvasObjectFromPalette(document, "Chapter");
    expect(object.type).toBe("Chapter");
    expect(object.title).toBe("Chapter 3");
    expect(object.proofBoundary).toContain("not runtime proof");
  });
});
