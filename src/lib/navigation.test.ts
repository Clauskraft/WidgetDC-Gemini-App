import { describe, expect, it } from "vitest";
import { FOOTER_NAV, LIBRARY_NAV, PRIMARY_NAV, allNavEntries, pageTitleFor } from "./navigation";

describe("navigation registry (GF-PR1 — single nav truth)", () => {
  it("every entry is a real route path — no hash anchors, no dead clicks", () => {
    for (const entry of allNavEntries()) {
      expect(entry.to.startsWith("/"), `${entry.label} has real path`).toBe(true);
      expect(entry.to.includes("#")).toBe(false);
    }
  });

  it("paths are unique and labels non-empty", () => {
    const entries = allNavEntries();
    expect(new Set(entries.map((e) => e.to)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.icon).toBeTruthy();
    }
  });

  it("primary nav is the golden flow front door: Chat first, then Work", () => {
    expect(PRIMARY_NAV[0]).toMatchObject({ to: "/", label: "Chat" });
    expect(PRIMARY_NAV.map((e) => e.to)).toContain("/observability");
  });

  it("library exposes every functional page and nothing synthetic", () => {
    const paths = LIBRARY_NAV.map((e) => e.to);
    for (const p of [
      "/graph",
      "/engagements",
      "/deliverable",
      "/patterns",
      "/consulting",
      "/adoption",
      "/news",
      "/storyline",
      "/monday-review",
      "/gems",
    ]) {
      expect(paths, `library has ${p}`).toContain(p);
    }
    // Stubs and deleted pages must NOT be reachable from nav.
    for (const p of ["/dashboard", "/capabilities", "/audit-factory"]) {
      expect(
        allNavEntries().map((e) => e.to),
        `${p} not in nav`,
      ).not.toContain(p);
    }
  });

  it("footer has settings and debug logs", () => {
    const paths = FOOTER_NAV.map((e) => e.to);
    expect(paths).toContain("/settings");
    expect(paths).toContain("/debug/logs");
  });

  it("pageTitleFor resolves titles for every registered path and falls back gracefully", () => {
    for (const entry of allNavEntries()) {
      expect(pageTitleFor(entry.to)).toBe(entry.label);
    }
    expect(pageTitleFor("/c/abc123")).toBe("Chat");
    expect(pageTitleFor("/gems/some-gem")).toBe("Gems");
    expect(pageTitleFor("/unknown-path")).toBe("WDC Agent Office");
  });
});
