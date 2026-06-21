import { describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/chat";
import { fetchIntentDetection, fetchRagGrounding, llmChatCompletion } from "@/lib/widgetdc.server";

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

describe("/api/chat intent detection", () => {
  it("adds the platform intent_detect signal to the chat system prompt", async () => {
    const query = "Forklar GraphRAG med Neo4j og lav et issue-tree";
    const response = await invokeChat({
      messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: query }] }],
    });

    expect(response.status).toBe(200);
    await response.text();

    expect(fetchIntentDetection).toHaveBeenCalledWith(query, "intent-test");
    expect(fetchRagGrounding).toHaveBeenCalledWith(query, "intent-test");

    const chatMessages = vi.mocked(llmChatCompletion).mock.calls[0][0];
    expect(chatMessages[0]).toMatchObject({ role: "system" });
    expect(chatMessages[0].content).toContain("WidgeTDC intent routing signal");
    expect(chatMessages[0].content).toContain("query_knowledge_graph");
    expect(chatMessages[0].content).toContain("Use this as a routing/context signal only");
  });
});
