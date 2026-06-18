import { useState } from "react";
import { Loader2, Presentation, FileDown } from "lucide-react";
import {
  generatePPTX,
  generateDOCX,
  generateXLSX,
  downloadBlob,
  slidesToMarkdown,
  type DocTheme,
} from "@/lib/output-generators";
import { ThemePicker } from "./ThemePicker";
import type { HeadlineSlide } from "@/routes/api/storyline";

type ExportFormat = "pptx" | "docx" | "xlsx";

const FORMATS: { format: ExportFormat; label: string; ext: string }[] = [
  { format: "pptx", label: "PowerPoint (.html)", ext: "html" },
  { format: "docx", label: "Word (.doc)",        ext: "doc"  },
  { format: "xlsx", label: "Excel (.xls)",       ext: "xls"  },
];

export function ExportToolbar({
  slides,
  theme,
  onThemeChange,
  onExported,
}: {
  slides: HeadlineSlide[];
  theme: DocTheme;
  onThemeChange: (t: DocTheme) => void;
  /** Called after a successful export with the format + correlationId for BOMItem emit */
  onExported?: (format: ExportFormat, correlationId: string) => void;
}) {
  const [exportingLocal, setExportingLocal] = useState<ExportFormat | null>(null);

  const doExport = async (format: ExportFormat) => {
    setExportingLocal(format);
    try {
      const markdown = slidesToMarkdown(slides);
      const title = slides[0]?.title ?? "storyline";
      const date = new Date().toISOString().slice(0, 10);
      const base = `${title.replace(/[^a-z0-9æøå]/gi, "-").toLowerCase()}-${date}`;
      const correlationId = crypto.randomUUID();

      const ext = FORMATS.find((f) => f.format === format)?.ext ?? format;
      if (format === "pptx") {
        downloadBlob(generatePPTX(markdown, theme), `${base}.${ext}`);
      } else if (format === "docx") {
        downloadBlob(generateDOCX(markdown, theme), `${base}.${ext}`);
      } else {
        downloadBlob(generateXLSX(markdown), `${base}.${ext}`);
      }

      onExported?.(format, correlationId);
    } finally {
      setExportingLocal(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="mb-1 text-sm font-medium">Eksportér</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Tema: <strong>{theme}</strong> — genererer direkte i browseren. PowerPoint eksporteres som HTML-slides (åbn i Chrome og print til PDF for bedste kvalitet).
        </p>
        <div className="flex flex-wrap gap-3">
          {FORMATS.map(({ format, label }) => (
            <button
              key={format}
              onClick={() => doExport(format)}
              disabled={exportingLocal !== null}
              className="inline-flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              {exportingLocal === format ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : format === "pptx" ? (
                <Presentation className="h-4 w-4" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>
      <ThemePicker value={theme} onChange={onThemeChange} />
    </div>
  );
}
