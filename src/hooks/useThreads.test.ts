import { describe, expect, it } from "vitest";
import { dedupeRecentThreads, type Thread } from "./useThreads";

const thread = (id: string, title: string, updatedAt: number): Thread => ({
  id,
  title,
  updatedAt,
  messages: [],
});

describe("dedupeRecentThreads", () => {
  it("preserves distinct thread ids even when normalized titles match", () => {
    const result = dedupeRecentThreads([
      thread("old", "Hvad er status", 10),
      thread("new", "  hvad   er STATUS ", 20),
      thread("other", "Arkitektur", 15),
    ]);

    expect(result.map((item) => item.id)).toEqual(["new", "other", "old"]);
  });

  it("keeps both the active and newer thread when their titles match", () => {
    const result = dedupeRecentThreads(
      [thread("new", "Hvad er status", 20), thread("active", "Hvad er status", 10)],
      "active",
    );

    expect(result.map((item) => item.id)).toEqual(["new", "active"]);
  });

  it("never collapses untitled draft threads", () => {
    const result = dedupeRecentThreads([
      thread("draft-a", "Ny samtale", 20),
      thread("draft-b", "Ny samtale", 10),
    ]);

    expect(result.map((item) => item.id)).toEqual(["draft-a", "draft-b"]);
  });

  it("collapses only duplicate durable ids", () => {
    const result = dedupeRecentThreads([
      thread("same", "Ny titel", 20),
      thread("same", "Gammel titel", 10),
    ]);

    expect(result).toEqual([thread("same", "Ny titel", 20)]);
  });
});
