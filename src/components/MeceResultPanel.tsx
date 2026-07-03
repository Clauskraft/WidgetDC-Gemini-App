import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import type { MeceResponse } from "@/routes/api/storyline";

export function MeceResultPanel({
  loading,
  result,
  onRerun,
}: {
  loading: boolean;
  result: MeceResponse | null;
  onRerun: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : result?.passed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : result ? (
            <XCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {loading
              ? "Kører MECE-check…"
              : result?.passed
                ? "MECE godkendt"
                : result
                  ? "MECE: mulige forbedringer"
                  : "MECE-check ikke kørt"}
          </span>
        </div>
        <button
          onClick={onRerun}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className="h-3 w-3" />
          Kør igen
        </button>
      </div>

      {result && !result.passed && (
        <div className="space-y-3">
          {result.issues.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                Problemer:
              </p>
              <ul className="space-y-1">
                {result.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-amber-500">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.suggestions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-primary">Forslag:</p>
              <ul className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-primary">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {result?.passed && (
        <p className="text-xs text-muted-foreground">
          Slides er MECE — ingen overlappende emner, storylinen dækker problemet fuldt ud.
        </p>
      )}
    </div>
  );
}
