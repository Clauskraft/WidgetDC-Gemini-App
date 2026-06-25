import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/chat";

vi.mock("@/lib/widgetdc.server", () => ({
  isPlatformConfigured: vi.fn(() => true),
  orchestratorChat: vi.fn(),
  councilChat: vi.fn(),
  llmChatCompletion: vi.fn(async () => ({
    text: "Intent-routed answer",
    meta: { provider: "test" },
  })),
  fetchIntentDetection: vi.fn(async (query: string) => ({
    query,
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
    count: 1,
  })),
  fetchRagGrounding: vi.fn(async () => null),
  modelPolicyPreflight: vi.fn(async () => ({ allowed: true })),
  storeChatMemory: vi.fn(async () => undefined),
  // AUR-6 memory hydration + BOMItem emit are awaited/called inside the handler;
  // the mock must provide them or the stream throws before the completion call.
  retrieveChatMemory: vi.fn(async () => null),
  emitChatBOMItem: vi.fn(async () => undefined),
}));

vi.mock("@/lib/providers.server", () => ({
  callDirectProvider: vi.fn(),
  streamDirectProvider: vi.fn(),
  openAiToolRound: vi.fn(),
  providerConfigured: vi.fn(() => false),
  providerForModel: vi.fn(() => "platform"),
}));

vi.mock("@/lib/chatTools.server", () => ({
  agenticToolsEnabled: vi.fn(() => false),
  executeToolCall: vi.fn(),
  CHAT_TOOL_SCHEMAS: [],
  MAX_TOOL_ROUNDS: 0,
}));

async function invokeChat(body: unknown, correlationId = "intent-test"): Promise<Response> {
  const POST = (
    Route as unknown as {
      options: { server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } } };
    }
  ).options.server.handlers.POST;
  const request = new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-correlation-id": correlationId },
    body: JSON.stringify(body),
  });
  return POST({ request });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(
      [
        'data: {"type":"plan","content":{"intentClarity":"0.91","mode":"analysis","style":"evidence-gated"}}',
        'data: {"type":"method","method":"analysis","agent":"intent-gateway","tier":2}',
        'data: {"type":"token","content":"Intent-routed answer"}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/chat WDC CLI chat stream routing", () => {
  it("routes the last UI-message user text through WDC CLI chat stream only", async () => {
    const query = "Forklar GraphRAG med Neo4j og lav et issue-tree";
    const response = await invokeChat({
      id: "thread-wdc-cli",
      messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: query }] }],
      deep: true,
    });

    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toContain("Intent-routed answer");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/wdc-chat/stream");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    });
    const payload = JSON.parse(String(init.body)) as {
      message: string;
      session_id?: string;
      preferences?: { method?: string; agent?: string; tier?: number; include_evidence?: boolean };
    };
    expect(payload.message).toBe(query);
    expect(payload.session_id).toBe("thread-wdc-cli");
    expect(payload.preferences).toMatchObject({
      method: "RLM",
      tier: 3,
      include_evidence: true,
    });
  });
});
