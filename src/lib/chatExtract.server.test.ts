import { describe, it, expect } from "vitest";
import { extractChatResult, llmChatProvider } from "./widgetdc.server";

describe("extractChatResult — platform chat content/response fields", () => {
  it("extracts the answer from a `content` field", () => {
    // Legacy chat envelope shape: { provider, model, content, usage }
    const env = {
      provider: "gemini",
      model: "gemini-2.5-flash",
      content: "A full answer.",
      usage: {},
    };
    expect(extractChatResult(env)?.text).toBe("A full answer.");
  });

  it("extracts `content` from a { result } wrapper too", () => {
    expect(extractChatResult({ result: { content: "wrapped" } })?.text).toBe("wrapped");
  });

  it("still extracts reason_deeply `recommendation`", () => {
    expect(extractChatResult({ result: { recommendation: "rec answer" } })?.text).toBe(
      "rec answer",
    );
  });

  it("prefers content over a (rare) co-present recommendation", () => {
    expect(extractChatResult({ content: "full", recommendation: "short" })?.text).toBe("full");
  });

  it("handles a bare string and returns null on empty/non-object", () => {
    expect(extractChatResult("hej")?.text).toBe("hej");
    expect(extractChatResult({ usage: {} })).toBeNull();
    expect(extractChatResult(null)).toBeNull();
  });

  it("extracts llm.generate `response` field", () => {
    expect(extractChatResult({ result: { response: "OK" } })?.text).toBe("OK");
  });
});

describe("llmChatProvider — model id → platform provider hint", () => {
  it("maps vendor prefixes to providers + bare model", () => {
    expect(llmChatProvider("openai/gpt-5")).toEqual({ provider: "openai", model: "gpt-5" });
    expect(llmChatProvider("google/gemini-2.5-pro")).toEqual({
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
    expect(llmChatProvider("anthropic/claude-haiku-4-5")).toEqual({
      provider: "claude",
      model: "claude-haiku-4-5",
    });
  });

  it("routes platform/unknown/undefined to the gemini default (no model)", () => {
    expect(llmChatProvider("platform/rlm")).toEqual({ provider: "gemini" });
    expect(llmChatProvider(undefined)).toEqual({ provider: "gemini" });
  });
});
