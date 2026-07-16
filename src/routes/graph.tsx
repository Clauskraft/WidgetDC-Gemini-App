import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Network, ChevronRight, Home } from "lucide-react";
import { PageShell } from "@/components/AppShell/PageShell";
import { GraphBlock } from "@/components/GraphBlock";
import { KnowledgeGraphBlock } from "@/components/KnowledgeGraphBlock";
import { GraphErrorBlock } from "@/components/GraphErrorBlock";
import { EmptyState } from "@/components/EmptyState";
import type { GraphSpec, KnowledgeGraphSpec } from "@/lib/figureBlocks";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Graph · WidgeTDC Aurora" },
      {
        name: "description",
        content: "Live read-only view of the WidgeTDC knowledge graph (Neo4j) with drill-down.",
      },
    ],
  }),
  component: GraphExplorer,
});

type QueryName = "label-overview" | "sample-subgraph" | "neighbors";

type ApiResult =
  | { kind: "knowledge-graph"; spec: KnowledgeGraphSpec }
  | { kind: "graph"; spec: GraphSpec };

type DrillStep = { nodeId: number; title: string };

const VIEWS: { id: QueryName; label: string; hint: string }[] = [
  { id: "label-overview", label: "Node labels", hint: "Top labels by count" },
  { id: "sample-subgraph", label: "Sample subgraph", hint: "Connected slice" },
  { id: "neighbors", label: "Agent neighbors", hint: "Edges out of :Agent" },
];

function GraphExplorer() {
  const [view, setView] = useState<QueryName>("label-overview");
  const [neighborLabel, setNeighborLabel] = useState("Agent");
  const [trail, setTrail] = useState<DrillStep[]>([]);
  const [data, setData] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (v: QueryName, label: string, path: DrillStep[]) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> =
        path.length > 0
          ? { query: "node-neighbors", nodeId: path[path.length - 1].nodeId, limit: 30 }
          : {
              query: v,
              limit: v === "label-overview" ? 12 : 30,
              ...(v === "neighbors" ? { label } : {}),
            };
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
    void load(view, neighborLabel, trail);
  }, [view, neighborLabel, trail, load]);

  const selectView = (v: QueryName) => {
    setTrail([]);
    setView(v);
  };

  // Drill: numeric "n123" ids expand that concrete node; a bare label (from the
  // label-overview) switches to that label's neighbor view.
  const onNodeActivate = useCallback((id: string, label?: string) => {
    const m = /^n(\d+)$/.exec(id);
    if (m) {
      setTrail((prev) => [...prev, { nodeId: Number(m[1]), title: label || id }]);
    } else if (id !== "__root__") {
      setNeighborLabel(id);
      setView("neighbors");
      setTrail([]);
    }
  }, []);

  const rootLabel =
    trail.length === 0
      ? null
      : view === "neighbors"
        ? `Naboer: ${neighborLabel}`
        : (VIEWS.find((vw) => vw.id === view)?.label ?? "Rod");

  return (
    <PageShell
      title="Knowledge graph"
      subtitle="Live read-only view af WidgeTDC Neo4j-grafen — vælg en node og tryk “Drill” for at udforske naboer."
      icon={<Network className="h-4 w-4 text-white" />}
      onRefresh={() => void load(view, neighborLabel, trail)}
      refreshing={loading}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((vw) => (
            <button
              key={vw.id}
              type="button"
              onClick={() => selectView(vw.id)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                view === vw.id && trail.length === 0
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
              title={vw.hint}
            >
              {vw.label}
            </button>
          ))}
        </div>

        {trail.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Drill-sti">
            <button
              type="button"
              onClick={() => setTrail([])}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
            >
              <Home className="h-3.5 w-3.5" />
              {rootLabel}
            </button>
            {trail.map((step, i) => (
              <span key={`${step.nodeId}-${i}`} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setTrail((prev) => prev.slice(0, i + 1))}
                  className={`max-w-[180px] truncate rounded-md px-2 py-1 ${
                    i === trail.length - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {step.title}
                </button>
              </span>
            ))}
          </nav>
        )}

        <div className="min-h-[420px] rounded-lg border bg-card p-4">
          {loading && !data ? (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Henter graf…
            </div>
          ) : error ? (
            <GraphErrorBlock kind="graph" errors={[error]} raw={error} />
          ) : data?.kind === "knowledge-graph" ? (
            <KnowledgeGraphBlock spec={data.spec} onNodeActivate={onNodeActivate} />
          ) : data?.kind === "graph" ? (
            <GraphBlock spec={data.spec} onNodeActivate={onNodeActivate} />
          ) : (
            <EmptyState
              icon={<Network className="h-7 w-7" />}
              title="Ingen graph-data"
              description="Vælg en visning ovenfor og tryk Refresh for at hente data fra Neo4j."
              className="h-[400px] border-0 shadow-none bg-transparent"
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
