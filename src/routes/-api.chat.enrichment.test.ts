import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/api/chat";

/**
 * GF-PR2: /api/chat parallel enrichment. fetchIntentDetection + fetchRagGrounding
 * fire CONCURRENTLY with the WDC backend stream and write `data-reasoning` /
 * `data-sources` parts the moment they resolve — first token is never blocked,
 * and a failed helper never breaks the stream.
 */

const fetchIntentDetection = vi.fn();
const fetchRagGrounding = vi.fn();

vi.mock("@/lib/widgetdc.server", () => ({
  isPlatformConfigured: vi.fn(() => true),
  fetchIntentDetection: (...args: unknown[]) => fetchIntentDetection(...args),
  fetchRagGrounding: (...args: unknown[]) => fetchRagGrounding(...args),
}));

vi.mock("@/lib/interaction-receipts.server", () => ({
  dispatchChatReceiptFailSoft: vi.fn(),
}));

async function invokeChat(body: unknown, correlationId = "enrich-test"): Promise<Response> {
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

const CHAT_BODY = {
  id: "thread-enrich",
  messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Forklar GraphRAG" }] }],
};

const INTENT_RESULT = {
  query: "Forklar GraphRAG",
  candidates: [
    {
      tool: "kg_rag.query",
      description: null,
      category: null,
      score: 0.82,
      matchCount: 12,
      maxSuccess: 1,
    },
    {
      tool: "srag.query",
      description: null,
      category: null,
      score: 0.61,
      matchCount: 8,
      maxSuccess: 0,
    },
  ],
  count: 2,
};

const RAG_RESULT = {
  context: "ctx",
  sources: [
    { text: "GraphRAG kombinerer graf og vektor.", source: "vidensarkiv:rag.md", score: 0.9 },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchIntentDetection.mockReset();
  fetchRagGrounding.mockReset();
  fetchMock.mockResolvedValue(
    new Response(
      ['data: {"type":"token","content":"Svar-tekst her"}', "data: [DONE]", ""].join("\n\n"),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WIDGETDC_BEARER_TOKEN", "test-bearer");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/chat parallel enrichment (GF-PR2)", () => {
  it("emits data-reasoning and data-sources parts alongside the streamed text", async () => {
    fetchIntentDetection.mockResolvedValue(INTENT_RESULT);
    fetchRagGrounding.mockResolvedValue(RAG_RESULT);

    const response = await invokeChat(CHAT_BODY);
    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toContain("Svar-tekst her");
    expect(text).toContain('"type":"data-reasoning"');
    expect(text).toContain('"intentTool":"kg_rag.query"');
    expect(text).toContain('"intentScore":0.82');
    expect(text).toContain('"type":"data-sources"');
    expect(text).toContain("vidensarkiv:rag.md");
    expect(fetchIntentDetection).toHaveBeenCalledWith("Forklar GraphRAG", "enrich-test");
    expect(fetchRagGrounding).toHaveBeenCalledWith("Forklar GraphRAG", "enrich-test");
  });

  it("never blocks the first token on slow enrichment (text precedes parts in the stream)", async () => {
    fetchIntentDetection.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(INTENT_RESULT), 250)),
    );
    fetchRagGrounding.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(RAG_RESULT), 250)),
    );

    const response = await invokeChat(CHAT_BODY);
    const text = await response.text();

    const firstTextIdx = text.indexOf("Svar-tekst her");
    const reasoningIdx = text.indexOf('"type":"data-reasoning"');
    expect(firstTextIdx).toBeGreaterThan(-1);
    expect(reasoningIdx).toBeGreaterThan(-1);
    // Backend tokens streamed immediately; enrichment landed later in the stream.
    expect(firstTextIdx).toBeLessThan(reasoningIdx);
  });

  it("WDC_CHAT_ENRICH=0 kill-switch skips both helpers entirely", async () => {
    vi.stubEnv("WDC_CHAT_ENRICH", "0");
    fetchIntentDetection.mockResolvedValue(INTENT_RESULT);
    fetchRagGrounding.mockResolvedValue(RAG_RESULT);

    const response = await invokeChat(CHAT_BODY);
    const text = await response.text();

    expect(text).toContain("Svar-tekst her");
    expect(text).not.toContain('"type":"data-reasoning"');
    expect(fetchIntentDetection).not.toHaveBeenCalled();
    expect(fetchRagGrounding).not.toHaveBeenCalled();
  });

  it("a rejecting helper never breaks the stream (fail-soft, no part emitted)", async () => {
    fetchIntentDetection.mockRejectedValue(new Error("intent down"));
    fetchRagGrounding.mockResolvedValue(null);

    const response = await invokeChat(CHAT_BODY);
    expect(response.status).toBe(200);
    const text = await response.text();

    expect(text).toContain("Svar-tekst her");
    expect(text).not.toContain('"type":"data-reasoning"');
    expect(text).not.toContain('"type":"data-sources"');
  });

  it("empty candidate lists emit nothing (no junk chips)", async () => {
    fetchIntentDetection.mockResolvedValue({ query: "q", candidates: [], count: 0 });
    fetchRagGrounding.mockResolvedValue({ context: "", sources: [] });

    const text = await (await invokeChat(CHAT_BODY)).text();
    expect(text).not.toContain('"type":"data-reasoning"');
    expect(text).not.toContain('"type":"data-sources"');
  });
});
