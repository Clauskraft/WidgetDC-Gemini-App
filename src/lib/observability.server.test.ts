import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMcpToolDiscoveryCacheForTests,
  extractGraphSnapshot,
  extractRuntimeSummary,
  fetchGraphSnapshot,
  fetchRuntimeSnapshot,
} from "./widgetdc.server";

beforeEach(() => {
  clearMcpToolDiscoveryCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractRuntimeSummary (Phase 3 Observability)", () => {
  it("normalizes the live runtime_summary shape and computes per-tool error rates", () => {
    const env = {
      total_agents: 16,
      total_requests: 6442,
      avg_success_rate: 82.8,
      top_tools: [
        { tool_name: "graph.stats", call_count: 2163, error_count: 69, avg_duration_ms: 2143 },
        {
          tool_name: "backend.http_post",
          call_count: 1711,
          error_count: 842,
          avg_duration_ms: 2053,
        },
      ],
    };
    const snap = extractRuntimeSummary(env);
    expect(snap?.totalAgents).toBe(16);
    expect(snap?.totalRequests).toBe(6442);
    expect(snap?.successRate).toBe(82.8);
    const httpPost = snap?.tools.find((t) => t.name === "backend.http_post");
    expect(httpPost?.errorRate).toBeCloseTo(842 / 1711, 5);
    expect(httpPost?.avgMs).toBe(2053);
  });

  it("unwraps a { result } envelope and drops zero-call tools", () => {
    const env = {
      result: {
        total_requests: 5,
        top_tools: [{ tool_name: "idle", call_count: 0, error_count: 0 }],
      },
    };
    const snap = extractRuntimeSummary(env);
    expect(snap?.tools).toEqual([]);
  });

  it("keeps a registered-but-idle fleet (agents present, zero requests)", () => {
    const snap = extractRuntimeSummary({
      total_agents: 16,
      avg_success_rate: 100,
      total_requests: 0,
      top_tools: [],
    });
    expect(snap).not.toBeNull();
    expect(snap?.totalAgents).toBe(16);
    expect(snap?.successRate).toBe(100);
  });

  it("returns null only when the fleet is genuinely empty", () => {
    expect(extractRuntimeSummary({ total_requests: 0, total_agents: 0, top_tools: [] })).toBeNull();
    expect(extractRuntimeSummary(null)).toBeNull();
  });

  it("normalizes audit.adoption_metrics fallback telemetry", () => {
    const snap = extractRuntimeSummary({
      result: {
        dau: 5,
        wau: 7,
        activationRate: 40,
        topTools: [
          { tool: "graph.read_cypher", count: 105 },
          { tool: "graph.stats", count: 20 },
        ],
      },
    });

    expect(snap).toMatchObject({
      totalAgents: 7,
      totalRequests: 125,
      successRate: 40,
      source: "audit.adoption_metrics",
    });
    expect(snap?.tools[0]).toMatchObject({
      name: "graph.read_cypher",
      calls: 105,
      errors: 0,
      errorRate: 0,
    });
  });

  it("normalizes intent.stats fallback telemetry and Neo4j integer counters", () => {
    const snap = extractRuntimeSummary({
      result: {
        toolCount: { low: 410, high: 0 },
        edgeCount: { low: 72, high: 0 },
        topTools: [
          { tool: "skill-knowledge-work", edgeCount: { low: 17, high: 0 }, avgConfidence: 0.5 },
          { tool: "flow-discover", edgeCount: { low: 15, high: 0 }, avgConfidence: 0.7 },
        ],
      },
    });

    expect(snap).toMatchObject({
      totalAgents: 410,
      totalRequests: 72,
      successRate: 60,
      source: "intent.stats",
    });
    expect(snap?.tools.map((tool) => [tool.name, tool.calls])).toEqual([
      ["skill-knowledge-work", 17],
      ["flow-discover", 15],
    ]);
  });

  it("uses catalogued runtime fallback tools instead of calling missing runtime_summary", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["audit.adoption_metrics"] } });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const body = JSON.parse(String(init?.body)) as { tool: string };
        expect(body.tool).toBe("audit.adoption_metrics");
        return Response.json({
          success: true,
          result: {
            wau: 5,
            activationRate: 40,
            topTools: [{ tool: "graph.stats", count: 20 }],
          },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRuntimeSnapshot("runtime-fallback")).resolves.toMatchObject({
      totalAgents: 5,
      totalRequests: 20,
      successRate: 40,
      source: "audit.adoption_metrics",
    });

    const postedTools = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).tool);
    expect(postedTools).toEqual(["audit.adoption_metrics"]);
  });
});

describe("extractGraphSnapshot", () => {
  it("reads nodes/relationships from the data_graph_stats { result } envelope", () => {
    const env = { result: { nodes: 1614954, relationships: 3593503, status: "online" } };
    expect(extractGraphSnapshot(env)).toEqual({
      nodes: 1614954,
      relationships: 3593503,
      online: true,
    });
  });

  it("treats a missing status as online, and explicit offline as offline", () => {
    expect(extractGraphSnapshot({ nodes: 1, relationships: 2 })?.online).toBe(true);
    expect(extractGraphSnapshot({ nodes: 1, relationships: 2, status: "offline" })?.online).toBe(
      false,
    );
  });

  it("returns null when neither count is present", () => {
    expect(extractGraphSnapshot({ status: "online" })).toBeNull();
    expect(extractGraphSnapshot(null)).toBeNull();
  });

  it("uses canonical graph.stats without calling the retired data_graph_stats alias", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["graph.stats"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const body = JSON.parse(String(init?.body)) as { tool: string };
        expect(body.tool).toBe("graph.stats");
        return Response.json({
          success: true,
          nodes: 1632144,
          relationships: 3621595,
          status: "online",
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGraphSnapshot("graph-regression")).resolves.toEqual({
      nodes: 1632144,
      relationships: 3621595,
      online: true,
    });
    const postedTools = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)).tool);
    expect(postedTools).toEqual(["graph.stats"]);
  });
});
