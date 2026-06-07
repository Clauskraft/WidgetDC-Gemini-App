import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Network, RefreshCw } from "lucide-react";
import { GraphBlock } from "@/components/GraphBlock";
import { KnowledgeGraphBlock } from "@/components/KnowledgeGraphBlock";
import { GraphErrorBlock } from "@/components/GraphErrorBlock";
import type { GraphSpec, KnowledgeGraphSpec } from "@/lib/figureBlocks";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Graph · WidgeTDC Aurora" },
      {
        name: "description",
        content: "Live read-only view of the WidgeTDC knowledge graph (Neo4j).",
      },
    ],
  }),
  component: GraphExplorer,
});

type QueryName = "label-overview" | "sample-subgraph" | "neighbors";

type ApiResult =
  | { kind: "knowledge-graph"; spec: KnowledgeGraphSpec }
  | { kind: "graph"; spec: GraphSpec };

const VIEWS: { id: QueryName; label: string; hint: string }[] = [
  { id: "label-overview", label: "Node labels", hint: "Top labels by count" },
  { id: "sample-subgraph", label: "Sample subgraph", hint: "Connected slice" },
  { id: "neighbors", label: "Agent neighbors", hint: "Edges out of :Agent" },
];

function GraphExplorer() {
  const [view, setView] = useState<QueryName>("label-overview");
  const [data, setData] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (q: QueryName) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { query: q, limit: q === "label-overview" ? 12 : 30 };
      if (q === "neighbors") body.label = "Agent";
      const res = await fetch("/api/graph/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      setData((await res.json()) as ApiResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(view);
  }, [view, load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Knowledge graph</h1>
            <p className="text-sm text-muted-foreground">
              Live read-only view of the WidgeTDC Neo4j graph.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(view)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((vw) => (
          <button
            key={vw.id}
            type="button"
            onClick={() => setView(vw.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              view === vw.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title={vw.hint}
          >
            {vw.label}
          </button>
        ))}
      </div>

      <div className="min-h-[420px] rounded-lg border bg-card p-4">
        {loading && !data ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Henter graf…
          </div>
        ) : error ? (
          <GraphErrorBlock kind="graph" errors={[error]} raw={error} />
        ) : data?.kind === "knowledge-graph" ? (
          <KnowledgeGraphBlock spec={data.spec} />
        ) : data?.kind === "graph" ? (
          <GraphBlock spec={data.spec} />
        ) : (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            Ingen data.
          </div>
        )}
      </div>
    </div>
  );
}
