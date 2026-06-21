import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardLogToPlatform, type ServerLogFields } from "./server-logger";

const ENABLED_ENV: NodeJS.ProcessEnv = {
  WIDGETDC_LOG_FORWARD: "1",
  WIDGETDC_BACKEND_URL: "https://backend.example.test/",
  WIDGETDC_API_KEY: "test-key",
} as NodeJS.ProcessEnv;

function fields(over: Partial<ServerLogFields> = {}): ServerLogFields {
  return { event: "mcp_tool_request_failed", requestId: "req_abc", ...over };
}

describe("forwardLogToPlatform (AUR-12 EventSpine forwarding)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ships error events to {base}/api/mcp/route with a bearer + EventSpine envelope", () => {
    forwardLogToPlatform("error", fields(), { error: { message: "boom" } }, ENABLED_ENV);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    // Trailing slash on the base is normalized away.
    expect(url).toBe("https://backend.example.test/api/mcp/route");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-key");
    expect(init.headers["x-correlation-id"]).toBe("req_abc");
    const body = JSON.parse(init.body);
    expect(body.tool).toBe("governance.emit_spine_event");
    expect(body.payload.event_type).toBe("tool_failed");
    expect(body.payload.source).toBe("widgetdc-gemini-frontend");
    expect(body.payload.correlation_id).toBe("req_abc");
    expect(body.payload.payload.logical_event_type).toBe("mcp_tool_request_failed");
    expect(body.payload.payload.error).toEqual({ message: "boom" });
  });

  it("does NOT forward info/warn events by default (only failures)", () => {
    forwardLogToPlatform("info", fields(), {}, ENABLED_ENV);
    forwardLogToPlatform("warn", fields(), {}, ENABLED_ENV);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a non-error event when explicitly flagged audit:true", () => {
    forwardLogToPlatform(
      "info",
      fields({ audit: true, event: "approval_granted" }),
      {},
      ENABLED_ENV,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payload.event_type).toBe("audit_event");
    expect(body.payload.outcome).toBe("info");
  });

  it("is a no-op when forwarding is disabled (default production state)", () => {
    const env = { ...ENABLED_ENV, WIDGETDC_LOG_FORWARD: "" } as NodeJS.ProcessEnv;
    forwardLogToPlatform("error", fields(), {}, env);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is a no-op when no platform base/key is configured", () => {
    const env = { WIDGETDC_LOG_FORWARD: "1" } as NodeJS.ProcessEnv;
    forwardLogToPlatform("error", fields(), {}, env);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors a deployment-configured sink tool override", () => {
    const env = {
      ...ENABLED_ENV,
      WIDGETDC_LOG_SINK_TOOL: "system_logs_ingest",
    } as NodeJS.ProcessEnv;
    forwardLogToPlatform("error", fields(), {}, env);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tool).toBe("system_logs_ingest");
  });

  it("never throws even if fetch rejects (fire-and-forget)", () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(() => forwardLogToPlatform("error", fields(), {}, ENABLED_ENV)).not.toThrow();
  });
});
