import { describe, expect, it } from "vitest";
import { DEFAULT_WORK_MODE_ID, WORK_MODES, getWorkMode, toWorkModeChatContext } from "./workModes";

describe("workModes", () => {
  it("exposes the required five work modes in product order", () => {
    expect(WORK_MODES.map((mode) => mode.label)).toEqual([
      "General",
      "Build App",
      "Write Book",
      "Investigate",
      "Operate WDC",
    ]);
    expect(DEFAULT_WORK_MODE_ID).toBe("general");
  });

  it("keeps prompts and object palettes mode-aware", () => {
    const book = getWorkMode("book");
    const investigation = getWorkMode("investigation");
    const operate = getWorkMode("operate");

    expect(book.prompt).toContain("bogprojekt");
    expect(book.canvasPalette).toContain("Chapter");
    expect(investigation.canvasPalette).toContain("Evidence");
    expect(operate.canvasPalette).toContain("A2A message");
  });

  it("provides chat context without exposing implementation-only fields", () => {
    const context = toWorkModeChatContext(getWorkMode("app"));

    expect(context).toEqual({
      id: "app",
      chatGreeting: "Hvilken app bygger vi?",
      chatTagline: expect.stringContaining("Build App mode"),
      prompt: expect.stringContaining("WDC-gated app-plan"),
      starters: expect.arrayContaining([expect.objectContaining({ title: "App-scope" })]),
    });
  });

  it("falls back to General for unknown mode ids", () => {
    expect(getWorkMode("missing").id).toBe("general");
  });
});
