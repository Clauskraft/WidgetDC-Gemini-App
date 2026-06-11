import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdownDocumentFallback } from "./documentFallback.server";
import {
  buildMcpToolRouteMap,
  callMcpTool,
  clearMcpToolDiscoveryCacheForTests,
  extractDeliverable,
  extractIntentDetection,
  extractMcpToolNames,
  extractProducedDocument,
  extractQuality,
  fetchIntentDetection,
  fetchRagGrounding,
  generateDeliverable,
  isSubstantiveDeliverable,
  localTemplateDeliverable,
  resolveMcpRoute,
} from "./widgetdc.server";

beforeEach(() => {
  clearMcpToolDiscoveryCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("unwraps canonical forge artifact fields", () => {
    expect(
      extractProducedDocument(
        {
          result: {
            file_base64: "UEsDBA==",
            filename: "forge-report.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        },
        "docx",
        "Forge Report",
      ),
    ).toEqual({
      base64: "UEsDBA==",
      filename: "forge-report.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });
});

describe("resolveMcpRoute", () => {
  it("routes canonical forge artifacts to backend even when orchestrator is configured", () => {
    const route = resolveMcpRoute("forge.artifact.generate", {
      WIDGETDC_BACKEND_URL: "https://backend.example",
      WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example/",
      WIDGETDC_ORCHESTRATOR_API_KEY: "fixture-orchestrator-auth",
      WIDGETDC_API_KEY: "fixture-backend-auth",
    });

    expect(route).toEqual({
      url: "https://backend.example/api/mcp/route",
      key: "fixture-backend-auth",
      target: "backend",
    });
  });

  it("keeps non-deliverable tools on the backend route", () => {
    const route = resolveMcpRoute("llm.generate", {
      WIDGETDC_BACKEND_URL: "https://backend.example",
      WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
      WIDGETDC_API_KEY: "fixture-backend-auth",
    });

    expect(route?.url).toBe("https://backend.example/api/mcp/route");
    expect(route?.target).toBe("backend");
  });
});

describe("MCP tool discovery routing", () => {
  it("extracts tool names from backend catalog shapes", () => {
    expect(
      extractMcpToolNames({
        success: true,
        data: {
          tools: ["llm.generate", "forge.artifact.generate"],
          definitions: [{ name: "context.fold" }, { canonical_tool: "graph.read_cypher" }],
        },
      }),
    ).toEqual(["llm.generate", "forge.artifact.generate", "context.fold", "graph.read_cypher"]);
  });

  it("keeps duplicate tools on backend and routes orchestrator-only tools there", () => {
    const backend = {
      url: "https://backend.example/api/mcp/route",
      key: "fixture-backend-auth",
      target: "backend" as const,
    };
    const orchestrator = {
      url: "https://orchestrator.example/api/mcp/route",
      key: "fixture-orchestrator-auth",
      target: "orchestrator" as const,
    };

    const routes = buildMcpToolRouteMap([
      { route: backend, catalog: { data: { tools: ["shared.tool", "backend.only"] } } },
      { route: orchestrator, catalog: { tools: ["shared.tool", "orchestrator.only"] } },
    ]);

    expect(routes.get("shared.tool")).toEqual(backend);
    expect(routes.get("backend.only")).toEqual(backend);
    expect(routes.get("orchestrator.only")).toEqual(orchestrator);
  });

  it("uses discovered orchestrator route for orchestrator-only calls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["backend.only"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: ["orchestrator.only"] });
      }
      if (url === "https://orchestrator.example/api/mcp/route") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          tool: "orchestrator.only",
          payload: { ok: true },
        });
        return Response.json({ result: "ok" });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool(
      "orchestrator.only",
      { ok: true },
      {
        env: {
          WIDGETDC_BACKEND_URL: "https://backend.example",
          WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
          WIDGETDC_API_KEY: "fixture-backend-auth",
          WIDGETDC_ORCHESTRATOR_API_KEY: "fixture-orchestrator-auth",
        },
      },
    );

    expect(result).toEqual({ result: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to /mcp/tools when /api/mcp/tools is not found", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["backend.only"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ error: "not found" }, { status: 404 });
      }
      if (url === "https://orchestrator.example/mcp/tools") {
        return Response.json({ tools: ["orchestrator.only"] });
      }
      if (url === "https://orchestrator.example/api/mcp/route") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          tool: "orchestrator.only",
          payload: { ok: true },
        });
        return Response.json({ result: "ok" });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool(
      "orchestrator.only",
      { ok: true },
      {
        env: {
          WIDGETDC_BACKEND_URL: "https://backend.example",
          WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
          WIDGETDC_API_KEY: "fixture-backend-auth",
          WIDGETDC_ORCHESTRATOR_API_KEY: "fixture-orchestrator-auth",
        },
      },
    );

    expect(result).toEqual({ result: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("caches backend fallback when backend discovery is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ error: "unavailable" }, { status: 503 });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: ["llm.generate"] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body)).tool).toBe("llm.generate");
        return Response.json({ result: "backend" });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callMcpTool(
      "llm.generate",
      { prompt: "x" },
      {
        env: {
          WIDGETDC_BACKEND_URL: "https://backend.example",
          WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
          WIDGETDC_API_KEY: "fixture-backend-auth",
          WIDGETDC_ORCHESTRATOR_API_KEY: "fixture-orchestrator-auth",
        },
      },
    );
    const second = await callMcpTool(
      "llm.generate",
      { prompt: "y" },
      {
        env: {
          WIDGETDC_BACKEND_URL: "https://backend.example",
          WIDGETDC_ORCHESTRATOR_URL: "https://orchestrator.example",
          WIDGETDC_API_KEY: "fixture-backend-auth",
          WIDGETDC_ORCHESTRATOR_API_KEY: "fixture-orchestrator-auth",
        },
      },
    );

    expect(result).toEqual({ result: "backend" });
    expect(second).toEqual({ result: "backend" });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/mcp/tools")),
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/mcp/route")),
    ).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("intent_detect chat routing signal", () => {
  const query = "Forklar GraphRAG med Neo4j og lav et issue-tree";

  it("extracts the current backend { query, candidates, count } shape", () => {
    const intent = extractIntentDetection({
      success: true,
      result: {
        query,
        candidates: [
          {
            tool: "query_knowledge_graph",
            category: null,
            score: 2.5,
            matchCount: 16,
            maxSuccess: 0,
          },
        ],
        count: 1,
      },
    });

    expect(intent).toEqual({
      query,
      count: 1,
      candidates: [
        {
          tool: "query_knowledge_graph",
          description: null,
          category: null,
          score: 2.5,
          matchCount: 16,
          maxSuccess: 0,
        },
      ],
    });
  });

  it("posts intent_detect with payload.query through discovered MCP routing", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["intent_detect"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          tool: "intent_detect",
          payload: { query },
        });
        return Response.json({
          result: {
            query,
            candidates: [{ tool: "query_knowledge_graph", score: 2.5, matchCount: 16 }],
            count: 1,
          },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchIntentDetection(query, "intent-regression")).resolves.toMatchObject({
      query,
      candidates: [{ tool: "query_knowledge_graph", score: 2.5, matchCount: 16 }],
      count: 1,
    });
  });

  it("rejects the legacy input-field error envelope", () => {
    expect(
      extractIntentDetection({
        success: true,
        result: {
          error: "Missing required field: query",
          candidates: [],
        },
      }),
    ).toBeNull();
  });
});

describe("platform deliverable writer fallback", () => {
  const brief =
    "GraphRAG med Neo4j tilbyder en overlegen tilgang til informationshentning og ræsonnement, når data har komplekse relationer og kontekst er afgørende.";

  it("uses the live platform writer path when legacy deliverable aliases are disabled", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");
    vi.stubEnv("WIDGETDC_ENABLE_LEGACY_DELIVERABLE_TOOLS", "");

    const writerMarkdown = [
      "# GraphRAG med Neo4j",
      "",
      "## SCQA",
      "Neo4j GraphRAG er relevant, når spørgsmål kræver relationel kontekst, evidensspor og forklarlig ræsonnering på tværs af entiteter [1]. Det afgørende valg er at bruge grafen til at reducere tvetydighed, mens vektor-RAG stadig kan fungere som recall-lag.",
      "",
      "## MECE Issue Tree",
      "```mermaid",
      "flowchart TD",
      "A[Decision] --> B[Relationskompleksitet]",
      "A --> C[Evidens og provenance]",
      "A --> D[Driftskrav]",
      "```",
      "",
      "## Anbefalinger",
      "Start med de vigtigste node- og relationstyper, bind claims til kilder, og brug graph expansion til at validere sammenhænge. Det giver bedre auditability og færre løse antagelser end en ren semantisk søgning.",
      "",
      "## Risici",
      "For bred ingestion uden ontologi skaber støj. Manglende citationer gør svaret svært at stole på. For høj latency kan dæmpes med cachede subgrafer og klare retrieval-grænser.",
      "",
      "Canvas notes:",
      "- Brug SCQA til at ramme beslutningen før teknologien.",
      "- Prioriter relationer, provenance og citationer.",
      "- Hold vektor-RAG som recall og Neo4j som reasoning-lag.",
    ].join("\n");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["srag.query", "reason_deeply"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const body = JSON.parse(String(init?.body)) as { tool: string; payload: unknown };
        if (body.tool === "srag.query") {
          return Response.json({
            result: {
              results: [
                {
                  text: "GraphRAG combines graph relationships, semantic retrieval and auditable evidence.",
                  source: "GraphRAG platform note",
                  score: 0.92,
                },
              ],
            },
          });
        }
        if (body.tool === "reason_deeply") {
          expect(JSON.stringify(body.payload)).toContain("Available evidence context");
          expect(JSON.stringify(body.payload)).toContain("RAG-backed consulting draft");
          return Response.json({ result: { recommendation: writerMarkdown } });
        }
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const deliverable = await generateDeliverable(brief, "analysis", {
      correlationId: "deliverable-regression",
      maxSections: 5,
    });

    expect(deliverable).toEqual({ markdown: writerMarkdown, citations: 1 });
    const postedTools = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).tool);
    expect(postedTools).toEqual(["srag.query", "reason_deeply"]);
  });

  it("uses srag response text as grounding context without legacy rag_route fallback", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["srag.query"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const body = JSON.parse(String(init?.body)) as { tool: string };
        expect(body.tool).toBe("srag.query");
        return Response.json({
          result: {
            response:
              "GraphRAG combines graph relationships, semantic retrieval and auditable evidence.",
          },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRagGrounding(brief, "rag-response")).resolves.toMatchObject({
      sources: [
        {
          text: "GraphRAG combines graph relationships, semantic retrieval and auditable evidence.",
        },
      ],
    });
    const postedTools = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).tool);
    expect(postedTools).toEqual(["srag.query"]);
  });

  it("does not treat failed MCP envelopes as grounding context", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["srag.query"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const body = JSON.parse(String(init?.body)) as { tool: string };
        expect(body.tool).toBe("srag.query");
        return Response.json({ success: false, error: `Tool Not Found: ${body.tool}` });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRagGrounding(brief, "rag-regression")).resolves.toBeNull();
    const postedTools = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).tool);
    expect(postedTools).toEqual(["srag.query"]);
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
