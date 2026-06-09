import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMcpToolDiscoveryCacheForTests,
  extractGraphSnapshot,
  extractRuntimeSummary,
  fetchGraphSnapshot,
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

  it("falls back to graph.stats when the legacy data_graph_stats alias returns a failed envelope", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "backend-key");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "orch-key");

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
        if (body.tool === "data_graph_stats") {
          return Response.json({ success: false, error: "Tool Not Found: data_graph_stats" });
        }
        if (body.tool === "graph.stats") {
          return Response.json({
            success: true,
            nodes: 1632144,
            relationships: 3621595,
            status: "online",
          });
        }
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
    expect(postedTools).toEqual(["data_graph_stats", "graph.stats"]);
  });
});
