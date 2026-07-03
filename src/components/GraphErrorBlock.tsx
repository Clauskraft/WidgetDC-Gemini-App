import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { GraphErrorKind } from "@/lib/figureBlocks";

/**
 * GraphErrorBlock — vises i stedet for graph/knowledge-graph når LLM'en
 * leverer ugyldigt {nodes, edges}-JSON. Giver brugeren synlig feedback
 * (i stedet for stille fallback til kode-blok) og afslører råt JSON i en
 * collapsible så fejlen kan inspiceres.
 */
export function GraphErrorBlock({
  kind,
  errors,
  raw,
}: {
  kind: GraphErrorKind;
  errors: string[];
  raw: string;
}) {
  const [open, setOpen] = useState(false);
  const label = kind === "knowledge-graph" ? "knowledge-graph" : "graph";
  return (
    <figure
      role="alert"
      className="aurora-figure aurora-figure--flat border border-destructive/40 bg-destructive/5 rounded-md p-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 shrink-0 text-destructive"
          style={{ width: 16, height: 16 }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-destructive">
            Kunne ikke rendere <code className="font-mono text-xs">{label}</code>-blok
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            LLM-svaret indeholdt ugyldigt {`{nodes, edges}`}-JSON. Diagrammet er sprunget over for
            ikke at fejle stille.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-foreground/90 list-disc pl-4">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 8 && (
              <li className="text-muted-foreground">…og {errors.length - 8} flere</li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown style={{ width: 12, height: 12 }} />
            ) : (
              <ChevronRight style={{ width: 12, height: 12 }} />
            )}
            {open ? "Skjul rå JSON" : "Vis rå JSON"}
          </button>
          {open && (
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-snug">
              <code>{raw}</code>
            </pre>
          )}
        </div>
      </div>
    </figure>
  );
}
