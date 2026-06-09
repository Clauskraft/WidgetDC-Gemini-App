import { describe, it, expect } from "vitest";
import { renderMarkdownDocumentFallback } from "./documentFallback.server";
import {
  extractDeliverable,
  extractProducedDocument,
  extractQuality,
  isSubstantiveDeliverable,
  localTemplateDeliverable,
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

  it("preserves Danish Latin-1 characters in local PDFs", () => {
    const doc = renderMarkdownDocumentFallback(
      "# Ræsonnement\n\nnår kræver sammenhænge afgørende\n\nCanvas notes:\n- æøå\n- ÆØÅ\n- ok",
      "pdf",
      { title: "Ræsonnement" },
    );
    const pdf = Buffer.from(doc.base64, "base64").toString("latin1");

    expect(pdf).toContain("Ræsonnement");
    expect(pdf).toContain("når kræver sammenhænge afgørende");
    expect(pdf).toContain("æøå");
    expect(pdf).not.toContain("R?sonnement");
  });
});

describe("isSubstantiveDeliverable", () => {
  const brief =
    "GraphRAG med Neo4j tilbyder en overlegen tilgang til informationshentning og ræsonnement.";

  it("rejects the prior brief-only export fallback", () => {
    const markdown = [
      "# Deliverable analysis",
      "",
      "## Brief",
      "",
      brief,
      "",
      "## Status",
      "",
      "Platform generation/rendering was unavailable, so this export contains the submitted brief only.",
      "",
      "Canvas notes:",
      "- Platform renderer did not return a document artifact.",
      "- Re-run generation when the upstream document pipeline is healthy.",
      "- Use server logs.",
    ].join("\n");

    expect(isSubstantiveDeliverable(markdown, brief)).toBe(false);
  });

  it("rejects brief-only content", () => {
    expect(isSubstantiveDeliverable(brief, brief)).toBe(false);
  });

  it("rejects code-and-canvas-only content", () => {
    const markdown = [
      "# Deliverable Analysis",
      "",
      "```mermaid",
      "graph TD",
      "A[Input] --> B[Output]",
      "```",
      "",
      "Canvas notes:",
      "- Deliverablen er genereret fra briefet, ikke kun eksporteret som rå input.",
      "- Brug anbefalingerne som arbejdsudkast.",
      "- Briefets hovedspørgsmål er GraphRAG.",
    ].join("\n");

    expect(isSubstantiveDeliverable(markdown, brief)).toBe(false);
  });

  it("accepts a real multi-section deliverable draft", () => {
    const markdown = [
      "# Deliverable Analysis",
      "",
      "## SCQA",
      "GraphRAG with Neo4j should be used when the question depends on relationships, provenance, and auditable reasoning across entities. The core decision is not whether vectors are useful, but where graph structure reduces ambiguity and improves explainability.",
      "",
      "## MECE Issue Tree",
      "```mermaid",
      "flowchart TD",
      "A[Decision] --> B[Relationship complexity]",
      "A --> C[Evidence traceability]",
      "A --> D[Operational constraints]",
      "```",
      "",
      "## Recommendations",
      "Start with high-value entity classes, bind each answer to evidence, and use vector retrieval only as an entry point into graph expansion. This gives users a clearer answer path and lets reviewers audit why a claim was made.",
      "",
      "## Implementation",
      "Define node kinds, relationship rules, retrieval thresholds, citation capture, and validation gates before scaling ingestion. Instrument failed lookups so ontology gaps become backlog items instead of hidden answer drift.",
      "",
      "Canvas notes:",
      "- Pin GraphRAG to relationship-heavy workflows.",
      "- Track evidence and provenance before expanding scope.",
      "- Separate vector recall from graph-based reasoning.",
    ].join("\n");

    expect(isSubstantiveDeliverable(markdown, brief)).toBe(true);
  });

  it("accepts the deterministic local template fallback", () => {
    const deliverable = localTemplateDeliverable(brief, "analysis");

    expect(deliverable.markdown).toContain("Canvas notes:");
    expect(deliverable.markdown).toContain("```mermaid");
    expect(deliverable.markdown).toContain("ræsonnement");
    expect(isSubstantiveDeliverable(deliverable.markdown, brief)).toBe(true);
  });
});
