import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ValidationResult } from "@/lib/gemResponseValidator";
import { ResponseValidationNotice } from "./ResponseValidationNotice";

const result = (severity: "error" | "warn"): ValidationResult => ({
  ok: severity !== "error",
  issues: [{ severity, code: "missing_canvas_notes", message: "Canvas notes mangler" }],
  artifacts: { flowBlocks: [], mermaidBlocks: [], tables: [], codeBlocks: [], canvasNotes: [] },
});

describe("ResponseValidationNotice", () => {
  it("presents validation failure as recoverable display degradation", () => {
    const html = renderToString(
      <ResponseValidationNotice result={result("error")} canvasReady={false} />,
    );
    expect(html).toContain("Svaret vises som tekst");
    expect(html).toContain("Aurora forsøger automatisk at reparere");
    expect(html).toContain("Tekniske detaljer");
    expect(html).not.toContain("Canvas-validering: 1 fejl");
  });

  it("does not call clean prose canvas-ready", () => {
    const success: ValidationResult = {
      ...result("warn"),
      ok: true,
      issues: [],
    };
    const html = renderToString(<ResponseValidationNotice result={success} canvasReady={false} />);
    expect(html).toContain("Svar valideret");
    expect(html).not.toContain("Canvas klar");
  });

  it("uses canvas-ready only when the actual canvas trigger is true", () => {
    const success: ValidationResult = {
      ...result("warn"),
      ok: true,
      issues: [],
    };
    const html = renderToString(<ResponseValidationNotice result={success} canvasReady />);
    expect(html).toContain("Canvas klar");
  });
});
