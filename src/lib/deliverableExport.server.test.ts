import { describe, it, expect } from "vitest";
import { extractProducedDocument } from "./widgetdc.server";

describe("extractProducedDocument (Phase 1b Output Forge)", () => {
  it("reads base64 from the `artifact` field and derives a docx mime", () => {
    const out = extractProducedDocument({ result: { artifact: "QUJD" } }, "docx", "My Brief");
    expect(out?.base64).toBe("QUJD");
    expect(out?.mediaType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(out?.filename).toBe("My-Brief.docx");
  });

  it("falls back across base64/bytes/data/content and honors explicit filename + mime", () => {
    expect(extractProducedDocument({ base64: "x" }, "pdf")?.base64).toBe("x");
    expect(extractProducedDocument({ bytes: "y" }, "pdf")?.base64).toBe("y");
    expect(extractProducedDocument({ data: "z" }, "pdf")?.base64).toBe("z");
    const explicit = extractProducedDocument(
      { content: "c", filename: "report.pdf", media_type: "application/pdf" },
      "pdf",
    );
    expect(explicit).toEqual({ base64: "c", filename: "report.pdf", mediaType: "application/pdf" });
  });

  it("derives a default pdf mime + sanitized filename", () => {
    const out = extractProducedDocument({ artifact: "QQ" }, "pdf", "a/b c?!");
    expect(out?.mediaType).toBe("application/pdf");
    expect(out?.filename).toBe("a-b-c-.pdf");
  });

  it("returns null when no base64 bytes are present", () => {
    expect(extractProducedDocument({ result: { status: "ok" } }, "docx")).toBeNull();
    expect(extractProducedDocument(null, "docx")).toBeNull();
  });
});
