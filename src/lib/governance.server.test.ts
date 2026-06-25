import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGovernancePlan,
  extractGovernancePlan,
  extractPlanActionResult,
} from "./governance.server";
import { clearMcpToolDiscoveryCacheForTests } from "./widgetdc.server";

beforeEach(() => {
  clearMcpToolDiscoveryCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractGovernancePlan (AUR-4)", () => {
  it("unwraps the { result } envelope and normalizes fields", () => {
    const plan = extractGovernancePlan({
      result: {
        plan_id: "plan_123",
        status: "pending_approval",
        scope: "production_write",
        risk_level: "high",
        description: "Promote phantom BOM run",
        target_service: "orchestrator",
      },
    });
    expect(plan).toEqual({
      planId: "plan_123",
      status: "pending_approval",
      approved: false,
      scope: "production_write",
      riskLevel: "high",
      description: "Promote phantom BOM run",
      targetService: "orchestrator",
      expiresAt: undefined,
    });
  });

  it("reads a top-level plan id and derives approved from status", () => {
    expect(extractGovernancePlan({ planId: "p1", status: "approved" })?.approved).toBe(true);
    expect(extractGovernancePlan({ id: "p2" })?.status).toBe("pending_approval");
    expect(extractGovernancePlan({ plan: { plan_id: "p3", approved: true } })?.approved).toBe(true);
  });

  it("returns null when no plan id is present", () => {
    expect(extractGovernancePlan({ status: "pending_approval" })).toBeNull();
    expect(extractGovernancePlan(null)).toBeNull();
    expect(extractGovernancePlan("nope")).toBeNull();
  });
});

describe("extractPlanActionResult (AUR-4)", () => {
  it("marks ok for a successful approve/execute", () => {
    expect(
      extractPlanActionResult({ result: { plan_id: "p1", status: "approved" } }, "p1"),
    ).toEqual({
      planId: "p1",
      status: "approved",
      ok: true,
      message: undefined,
    });
  });

  it("marks NOT ok for failed/rejected or success:false envelopes", () => {
    expect(extractPlanActionResult({ status: "failed", error: "boom" }, "p1")?.ok).toBe(false);
    expect(extractPlanActionResult({ status: "rejected" }, "p1")?.ok).toBe(false);
    expect(extractPlanActionResult({ success: false, status: "approved" }, "p1")?.ok).toBe(false);
  });

  it("falls back to the supplied plan id when the envelope omits it", () => {
    expect(extractPlanActionResult({ status: "executed" }, "fallback-id")?.planId).toBe(
      "fallback-id",
    );
  });
});

describe("createGovernancePlan — wired MCP call", () => {
  it("posts governance_plan_create with apply:false (HITL never auto-approves)", async () => {
    vi.stubEnv("WIDGETDC_BACKEND_URL", "https://backend.example");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_URL", "https://orchestrator.example");
    vi.stubEnv("WIDGETDC_API_KEY", "fixture-backend-auth");
    vi.stubEnv("WIDGETDC_ORCHESTRATOR_API_KEY", "fixture-orchestrator-auth");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://backend.example/api/mcp/tools") {
        return Response.json({ data: { tools: ["governance_plan_create"] } });
      }
      if (url === "https://orchestrator.example/api/mcp/tools") {
        return Response.json({ tools: [] });
      }
      if (url === "https://backend.example/api/mcp/route") {
        const parsedBody = JSON.parse(String(init?.body)) as {
          tool: string;
          payload: Record<string, unknown>;
        };
        expect(parsedBody.tool).toBe("governance_plan_create");
        expect(parsedBody.payload.apply).toBe(false);
        expect(parsedBody.payload.target_service).toBe("orchestrator");
        return Response.json({ result: { plan_id: "plan_xyz", status: "pending_approval" } });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await createGovernancePlan({
      description: "Promote phantom BOM run to production",
      scope: "production_write",
      targetService: "orchestrator",
    });

    expect(plan).toMatchObject({ planId: "plan_xyz", status: "pending_approval", approved: false });
  });
});
