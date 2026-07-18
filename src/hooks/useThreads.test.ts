import { describe, expect, it } from "vitest";
import { dedupeRecentThreads, type Thread } from "./useThreads";

const thread = (id: string, title: string, updatedAt: number): Thread => ({
  id,
  title,
  updatedAt,
  messages: [],
});

describe("dedupeRecentThreads", () => {
  it("keeps the newest thread for duplicate normalized titles", () => {
    const result = dedupeRecentThreads([
      thread("old", "Hvad er status", 10),
      thread("new", "  hvad   er STATUS ", 20),
      thread("other", "Arkitektur", 15),
    ]);

    expect(result.map((item) => item.id)).toEqual(["new", "other"]);
  });

  it("keeps the active duplicate even when it is older", () => {
    const result = dedupeRecentThreads(
      [thread("new", "Hvad er status", 20), thread("active", "Hvad er status", 10)],
      "active",
    );

    expect(result.map((item) => item.id)).toEqual(["active"]);
  });

  it("never collapses untitled draft threads", () => {
    const result = dedupeRecentThreads([
      thread("draft-a", "Ny samtale", 20),
      thread("draft-b", "Ny samtale", 10),
    ]);

    expect(result.map((item) => item.id)).toEqual(["draft-a", "draft-b"]);
  });
});
