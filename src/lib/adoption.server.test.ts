/**
 * Tests for adoption.server helpers (B19 / LIN-1915).
 *
 * Each helper must fail-soft: a 5xx, a network error, or missing config
 * must NOT throw — it must return `{ ok: false, error }` so the UI can
 * render an error card per-source without blanking the dashboard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.WIDGETDC_BACKEND_URL = "https://example.test";
  process.env.WIDGETDC_API_KEY = "test-key";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function importHelpers() {
  return await import("./adoption.server");
}

describe("adoption.server — getAdoptionMetrics", () => {
  it("parses a flat adoption-metrics payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            dau: 42,
            wau: 137,
            activationRate: 0.73,
            featureCoverage: 0.81,
            adoptionFunnel: {
              aware: 100,
              onboarded: 80,
              activated: 60,
              regular: 40,
              power: 12,
            },
            topTools: [
              { name: "srag.query", count: 320 },
              { name: "rag_route", count: 180 },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getAdoptionMetrics } = await importHelpers();
    const r = await getAdoptionMetrics();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.dau).toBe(42);
    expect(r.data.wau).toBe(137);
    expect(r.data.activationRate).toBeCloseTo(0.73);
    expect(r.data.adoptionFunnel.activated).toBe(60);
    expect(r.data.topTools).toHaveLength(2);
    expect(r.data.topTools[0].name).toBe("srag.query");
    expect(r.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 503 })));
    const { getAdoptionMetrics } = await importHelpers();
    const r = await getAdoptionMetrics();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBeTruthy();
  });

  it("returns ok: false on network error (does not throw)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const { getAdoptionMetrics } = await importHelpers();
    const r = await getAdoptionMetrics();
    expect(r.ok).toBe(false);
  });
});

describe("adoption.server — getIntentStats", () => {
  it("parses snake_case fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: { tool_count: 410, pattern_count: 72, avg_confidence: 0.86 },
          }),
          { status: 200 },
        ),
      ),
    );
    const { getIntentStats } = await importHelpers();
    const r = await getIntentStats();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.toolCount).toBe(410);
    expect(r.data.patternCount).toBe(72);
    expect(r.data.avgConfidence).toBeCloseTo(0.86);
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    const { getIntentStats } = await importHelpers();
    const r = await getIntentStats();
    expect(r.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const { getIntentStats } = await importHelpers();
    const r = await getIntentStats();
    expect(r.ok).toBe(false);
  });
});

describe("adoption.server — getEnforcement", () => {
  it("parses enforcement payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: { enforced: true, violations_24h: 3, total_checks: 1240 },
          }),
          { status: 200 },
        ),
      ),
    );
    const { getEnforcement } = await importHelpers();
    const r = await getEnforcement();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.enforced).toBe(true);
    expect(r.data.violations24h).toBe(3);
    expect(r.data.totalChecks).toBe(1240);
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const { getEnforcement } = await importHelpers();
    const r = await getEnforcement();
    expect(r.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns")));
    const { getEnforcement } = await importHelpers();
    const r = await getEnforcement();
    expect(r.ok).toBe(false);
  });
});

describe("adoption.server — getA2AReconcile", () => {
  it("normalizes status string", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: true, result: { status: "OK", detail: "all green" } }),
            { status: 200 },
          ),
        ),
    );
    const { getA2AReconcile } = await importHelpers();
    const r = await getA2AReconcile();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe("OK");
    expect(r.data.detail).toBe("all green");
  });

  it("maps degraded/blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, result: { status: "degraded" } }), {
          status: 200,
        }),
      ),
    );
    const { getA2AReconcile } = await importHelpers();
    const r = await getA2AReconcile();
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.status).toBe("DEGRADED");
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 504 })));
    const { getA2AReconcile } = await importHelpers();
    const r = await getA2AReconcile();
    expect(r.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connreset")));
    const { getA2AReconcile } = await importHelpers();
    const r = await getA2AReconcile();
    expect(r.ok).toBe(false);
  });
});

describe("adoption.server — getWonderStatus", () => {
  it("parses nested a2a bridge status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: {
              status: "ok",
              a2a_bridge: { status: "degraded" },
              summary: "running",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const { getWonderStatus } = await importHelpers();
    const r = await getWonderStatus();
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.status).toBe("OK");
    expect(r.data.a2aBridge).toBe("DEGRADED");
    expect(r.data.detail).toBe("running");
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const { getWonderStatus } = await importHelpers();
    const r = await getWonderStatus();
    expect(r.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    const { getWonderStatus } = await importHelpers();
    const r = await getWonderStatus();
    expect(r.ok).toBe(false);
  });
});

describe("adoption.server — getDeployedHealth", () => {
  it("parses commit_sha + short_commit_sha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "ok",
            commit_sha: "abcdef1234567890",
            short_commit_sha: "abcdef1",
          }),
          { status: 200 },
        ),
      ),
    );
    const { getDeployedHealth } = await importHelpers();
    const r = await getDeployedHealth();
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.status).toBe("ok");
    expect(r.data.commitSha).toBe("abcdef1234567890");
    expect(r.data.shortCommitSha).toBe("abcdef1");
  });

  it("derives short SHA when only commit_sha provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", commit_sha: "abcdef1234567890" }), {
          status: 200,
        }),
      ),
    );
    const { getDeployedHealth } = await importHelpers();
    const r = await getDeployedHealth();
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.shortCommitSha).toBe("abcdef1");
  });

  it("returns ok: false on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const { getDeployedHealth } = await importHelpers();
    const r = await getDeployedHealth();
    expect(r.ok).toBe(false);
  });

  it("returns ok: false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));
    const { getDeployedHealth } = await importHelpers();
    const r = await getDeployedHealth();
    expect(r.ok).toBe(false);
  });

  it("returns backend_not_configured when env unset", async () => {
    delete process.env.WIDGETDC_BACKEND_URL;
    delete process.env.WIDGETDC_ORCHESTRATOR_URL;
    const { getDeployedHealth } = await importHelpers();
    const r = await getDeployedHealth();
    if (r.ok) throw new Error("expected error");
    expect(r.error).toBe("backend_not_configured");
  });
});

describe("adoption.server — getAdoptionDashboardSnapshot", () => {
  it("aggregates all 6 results in parallel; one failure does not break others", async () => {
    let callIdx = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        callIdx++;
        if (url.endsWith("/health")) {
          return new Response(
            JSON.stringify({
              status: "ok",
              commit_sha: "deadbeefcafe",
              short_commit_sha: "deadbee",
            }),
            { status: 200 },
          );
        }
        // First MCP call fails, others succeed — simulate one degraded source.
        if (callIdx === 2) {
          return new Response("", { status: 502 });
        }
        return new Response(JSON.stringify({ success: true, result: { dau: 1, status: "ok" } }), {
          status: 200,
        });
      }),
    );
    const { getAdoptionDashboardSnapshot } = await importHelpers();
    const snap = await getAdoptionDashboardSnapshot();
    expect(snap.deployedHealth.ok).toBe(true);
    // At least one source failed (the 502), but the snapshot itself returned.
    const failures = [
      snap.adoptionMetrics,
      snap.intentStats,
      snap.enforcement,
      snap.a2aReconcile,
      snap.wonderStatus,
    ].filter((r) => !r.ok).length;
    expect(failures).toBeGreaterThanOrEqual(1);
    expect(snap.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
