import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { fetchServerLogs } from "@/lib/server-logs.functions";
import { PageShell } from "@/components/AppShell/PageShell";

const searchSchema = z.object({ requestId: z.string().optional() });

export const Route = createFileRoute("/debug/logs")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Debug — Server logs" }, { name: "robots", content: "noindex" }],
  }),
  component: DebugLogsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Kunne ikke indlæse: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Ikke fundet</div>,
});

function DebugLogsPage() {
  const { requestId: initial } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [value, setValue] = useState(initial ?? "");
  const callFetch = useServerFn(fetchServerLogs);

  const query = useMutation({
    mutationFn: (requestId: string) => callFetch({ data: { requestId } }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const requestId = value.trim();
    if (!requestId) return;
    navigate({ search: { requestId }, replace: true });
    query.mutate(requestId);
  };

  return (
    <PageShell
      title="Debug logs"
      subtitle="Indsæt et requestId for at se den strukturerede log. Logs gemmes i 7 dage."
    >
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="req_..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled={query.isPending}
          >
            {query.isPending ? "Henter…" : "Hent"}
          </button>
        </form>

        {query.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {(query.error as Error).message}
          </div>
        ) : null}

        {query.data ? (
          query.data.rows.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Ingen log-poster fundet for dette requestId.
            </div>
          ) : (
            <ol className="space-y-3">
              {query.data.rows.map((row) => (
                <li key={row.id} className="rounded-md border border-border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                    <span className="font-mono">{new Date(row.created_at).toISOString()}</span>
                    <span className="flex items-center gap-2">
                      <LevelBadge level={row.level} />
                      <span className="font-mono text-muted-foreground">{row.event}</span>
                    </span>
                  </div>
                  <pre className="overflow-x-auto p-3 text-xs leading-snug">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </div>
    </PageShell>
  );
}

function LevelBadge({ level }: { level: string }) {
  const cls =
    level === "error"
      ? "bg-destructive/15 text-destructive"
      : level === "warn"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 font-mono uppercase ${cls}`}>{level}</span>;
}
