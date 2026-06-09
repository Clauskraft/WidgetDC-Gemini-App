import { describe, it, expect } from "vitest";
import { renderMarkdownDocumentFallback } from "./documentFallback.server";
import {
  extractDeliverable,
  extractProducedDocument,
  extractQuality,
  resolveMcpRoute,
} from "./widgetdc.server";

describe("extractDeliverable (Phase 1 Deliverable Studio)", () => {
  it("returns markdown + 0 citations for a bare string", () => {
    expect(extractDeliverable("# Title\n\nbody")).toEqual({
      markdown: "# Title\n\nbody",
      citations: 0,
    });
  });

  it("unwraps the standard { result } MCP envelope", () => {
    const env = {
      call_id: "x",
      status: "success",
      result: { markdown: "## Heading", citations: [1, 2, 3] },
    };
    expect(extractDeliverable(env)).toEqual({ markdown: "## Heading", citations: 3 });
  });

  it("falls back across content/document/deliverable/report fields", () => {
    expect(extractDeliverable({ content: "from content" })?.markdown).toBe("from content");
    expect(extractDeliverable({ document: "from document" })?.markdown).toBe("from document");
    expect(extractDeliverable({ deliverable: "from deliverable" })?.markdown).toBe(
      "from deliverable",
    );
    expect(extractDeliverable({ report: "from report" })?.markdown).toBe("from report");
  });

  it("reads a numeric citation_count when no array is present", () => {
    expect(extractDeliverable({ markdown: "x", citation_count: 7 })?.citations).toBe(7);
  });

  it("returns null for empty / non-markdown payloads", () => {
    expect(extractDeliverable("   ")).toBeNull();
    expect(extractDeliverable(null)).toBeNull();
    expect(extractDeliverable({ unrelated: true })).toBeNull();
    expect(extractDeliverable(42)).toBeNull();
  });
});

describe("extractQuality (PRISM gate)", () => {
  it("reads aggregate + dimensions", () => {
    const env = { result: { aggregate: 8.8, dimensions: { precision: 9, safety: 10 } } };
    expect(extractQuality(env)).toEqual({ score: 8.8, dimensions: { precision: 9, safety: 10 } });
  });

  it("falls back to overall then score", () => {
    expect(extractQuality({ overall: 7.5 })?.score).toBe(7.5);
    expect(extractQuality({ score: 6 })?.score).toBe(6);
  });

  it("returns null when no numeric score is present", () => {
    expect(extractQuality({ verdict: "good" })).toBeNull();
    expect(extractQuality(null)).toBeNull();
  });
});

describe("extractProducedDocument (Output Forge)", () => {
  it("unwraps artifact bytes with a stable fallback filename", () => {
    expect(extractProducedDocument({ result: { artifact: "YWJj" } }, "docx", "My Report")).toEqual({
      base64: "YWJj",
      filename: "My-Report.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });
});

describe("resolveMcpRoute", () => {
  it("routes deliverable tools to the orchestrator when configured", () => {
    const route = resolveMcpRoute("produce_document", {
      WIDGETDC_BACKEND_URL: "https://backend.example",
      WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example/",
      WIDGETDC_ORCHESTRATOR_API_KEY: "orch-key",
      WIDGETDC_API_KEY: "backend-key",
    });

    expect(route).toEqual({
      url: "https://orchestrator.example/api/mcp/route",
      key: "orch-key",
      target: "orchestrator",
    });
  });

  it("keeps non-deliverable tools on the backend route", () => {
    const route = resolveMcpRoute("llm_chat", {
      WIDGETDC_BACKEND_URL: "https://backend.example",
      WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
      WIDGETDC_API_KEY: "backend-key",
    });

    expect(route?.url).toBe("https://backend.example/api/mcp/route");
    expect(route?.target).toBe("backend");
  });
});

describe("renderMarkdownDocumentFallback", () => {
  it("produces a minimal DOCX package", () => {
    const doc = renderMarkdownDocumentFallback("# Title\n\nBody", "docx", { title: "Title" });
    const bytes = Buffer.from(doc.base64, "base64");

    expect(doc.filename).toBe("Title.docx");
    expect(doc.mediaType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(bytes.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("produces a minimal PDF", () => {
    const doc = renderMarkdownDocumentFallback("# Title\n\nBody", "pdf", { title: "Title" });
    const bytes = Buffer.from(doc.base64, "base64");

    expect(doc.filename).toBe("Title.pdf");
    expect(doc.mediaType).toBe("application/pdf");
    expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
