import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callDirectProvider, openAiToolRound, streamDirectProvider } from "./providers.server";

const ORIGINAL_ENV = process.env.OPENAI_API_KEY;

function lastJsonBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
  expect(init?.body).toBeTypeOf("string");
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

describe("OpenAI chat request token parameters", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("uses max_completion_tokens for non-streaming chat completions", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: "long answer" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callDirectProvider("openai/gpt-5", [{ role: "user", content: "answer fully" }]);

    const body = lastJsonBody(fetchMock);
    expect(body.max_completion_tokens).toBe(4096);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("uses max_completion_tokens for streaming chat completions", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'),
        );
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await streamDirectProvider("openai/gpt-5", [{ role: "user", content: "answer fully" }], {
      onDelta: () => {},
    });

    const body = lastJsonBody(fetchMock);
    expect(body.max_completion_tokens).toBe(4096);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("uses max_completion_tokens for OpenAI tool rounds", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: "final answer" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await openAiToolRound(
      "openai/gpt-5",
      [{ role: "user", content: "use tools if needed" }],
      [],
      new AbortController().signal,
    );

    const body = lastJsonBody(fetchMock);
    expect(body.max_completion_tokens).toBe(4096);
    expect(body).not.toHaveProperty("max_tokens");
  });
});
