import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  intent: vi.fn(),
  rag: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/widgetdc.server", () => ({
  isPlatformConfigured: () => true,
  fetchIntentDetection: mocks.intent,
  fetchRagGrounding: mocks.rag,
}));

vi.mock("@/lib/interaction-receipts.server", () => ({
  dispatchChatReceiptFailSoft: vi.fn(),
}));

let post: (context: { request: Request }) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("WIDGETDC_BEARER_TOKEN", "row927-test-only");
  vi.stubEnv("WDC_CHAT_ENRICH", "1");
  mocks.intent.mockResolvedValue(null);
  mocks.rag.mockResolvedValue(null);
  mocks.fetch.mockResolvedValue(new Response(
    'data: {"type":"token","content":"Isoleret svar"}\n\ndata: [DONE]\n\n',
    { headers: { "content-type": "text/event-stream" } },
  ));
  vi.stubGlobal("fetch", mocks.fetch);
  const { Route: ChatRoute } = await import("./chat");
  post = (ChatRoute as unknown as {
    options: { server: { handlers: { POST: typeof post } } };
  }).options.server.handlers.POST;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function user(text: string, internal = false) {
  return {
    role: "user",
    parts: [{ type: "text", text }],
    ...(internal ? { metadata: { widgetdc_internal: "self_heal" } } : {}),
  };
}

async function invoke(messages: unknown[]) {
  const response = await post({
    request: new Request("https://example.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": "row927" },
      body: JSON.stringify({ id: "row927-thread", messages }),
    }),
  });
  expect(response.status).toBe(200);
  await response.text();
}

function generationText() {
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const init = mocks.fetch.mock.calls[0][1] as RequestInit;
  return (JSON.parse(String(init.body)) as { message: string }).message;
}

describe("row927 real chat route enrichment and repair generation", () => {
  it("grounds both helpers in the genuine question while generating from repair instructions", async () => {
    await invoke([
      user("Forklar den konkrete leverandørkontrol"),
      { role: "assistant", content: "Svar med defekt struktur" },
      user("Ret strukturen i det forrige svar", true),
    ]);
    expect(mocks.intent).toHaveBeenCalledWith("Forklar den konkrete leverandørkontrol", "row927");
    expect(mocks.rag).toHaveBeenCalledWith("Forklar den konkrete leverandørkontrol", "row927");
    expect(generationText()).toBe("Ret strukturen i det forrige svar");
  });

  it("selects the latest genuine question across multiple user turns and repair attempts", async () => {
    await invoke([
      user("Første reelle spørgsmål"),
      user("Første interne rettelse", true),
      user("Andet reelle spørgsmål"),
      { role: "assistant", content: "Andet svar" },
      user("Anden interne rettelse", true),
      user("Tredje interne rettelse", true),
    ]);
    expect(mocks.intent).toHaveBeenCalledWith("Andet reelle spørgsmål", "row927");
    expect(mocks.rag).toHaveBeenCalledWith("Andet reelle spørgsmål", "row927");
    expect(generationText()).toBe("Tredje interne rettelse");
  });

  it("treats unmarked user text as a genuine question regardless of repair-like wording", async () => {
    const question = "Self-heal forsøg 1 er emnet for mit spørgsmål";
    await invoke([user("Tidligere spørgsmål"), user(question)]);
    expect(mocks.intent).toHaveBeenCalledWith(question, "row927");
    expect(mocks.rag).toHaveBeenCalledWith(question, "row927");
    expect(generationText()).toBe(question);
  });

  it("does not invent an enrichment question when only an internal repair is present", async () => {
    await invoke([user("Kun en intern reparationsinstruks", true)]);
    expect(mocks.intent).not.toHaveBeenCalled();
    expect(mocks.rag).not.toHaveBeenCalled();
    expect(generationText()).toBe("Kun en intern reparationsinstruks");
  });
});
