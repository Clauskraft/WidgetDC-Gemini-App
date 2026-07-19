import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { ValidationResult } from "@/lib/gemResponseValidator";
import { cn } from "@/lib/utils";

export function ResponseValidationNotice({
  result,
  canvasReady,
}: {
  result: ValidationResult;
  canvasReady: boolean;
}) {
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.issues.filter((issue) => issue.severity === "warn");

  if (result.ok && warnings.length === 0) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
        <ShieldCheck className="h-3 w-3" />
        {canvasReady ? "Canvas klar" : "Svar valideret"}
      </div>
    );
  }

  const hasErrors = errors.length > 0;

  return (
    <div
      className={cn(
        "mt-2 rounded-lg border px-3 py-2 text-xs",
        hasErrors
          ? "border-destructive/30 bg-destructive/5 text-foreground"
          : "border-amber-500/30 bg-amber-500/5 text-foreground",
      )}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0",
            hasErrors ? "text-destructive" : "text-amber-400",
          )}
        />
        <div className="space-y-1">
          <p className="font-medium">
            {hasErrors ? "Svaret vises som tekst" : "Svarformatet kræver opmærksomhed"}
          </p>
          <p className="text-muted-foreground">
            Aurora forsøger automatisk at reparere strukturen. Indholdet bevares, hvis
            canvasvisningen ikke kan bygges helt.
          </p>
        </div>
      </div>
      <details className="mt-2 border-t border-border/70 pt-2 text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground/80">
          Tekniske detaljer ({errors.length + warnings.length})
        </summary>
        <ul className="mt-2 space-y-1 pl-4">
          {result.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="list-disc">
              <span className="font-mono opacity-70">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
