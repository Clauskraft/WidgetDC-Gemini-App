import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraphBlock } from "@/components/GraphBlock";
import { KnowledgeGraphBlock } from "@/components/KnowledgeGraphBlock";
import { GraphErrorBlock } from "@/components/GraphErrorBlock";
import {
  validateGraphLikeSpec,
  type GraphSpec,
  type KnowledgeGraphSpec,
} from "@/lib/figureBlocks";

/**
 * Isoleret harness til visuelle regression-snapshots af graf-renderingen.
 * Bruges af Playwright (e2e/graph.spec.ts) — IKKE en del af app-navigationen.
 *
 *   /visual/graph?case=<id>&fs=1
 *
 * Animationer er deaktiveret og toolbar tvinges synlig, så snapshots er
 * deterministiske på tværs af kørsler.
 */

const linearGraph: GraphSpec = {
  caption: "Pipeline (linear)",
  nodes: [
    { id: "ingest", label: "Ingest", type: "source" },
    { id: "embed", label: "Embed", type: "tool" },
    { id: "store", label: "Vector store", type: "database" },
    { id: "answer", label: "Answer", type: "agent" },
  ],
  edges: [
    { source: "ingest", target: "embed", label: "chunks" },
    { source: "embed", target: "store", label: "vectors" },
    { source: "store", target: "answer", label: "top-k" },
  ],
};

const branchingGraph: GraphSpec = {
  caption: "Agent routing",
  nodes: [
    { id: "user", label: "User", type: "agent" },
    { id: "router", label: "Router", type: "tool" },
    { id: "rag", label: "RAG", type: "tool" },
    { id: "code", label: "Code agent", type: "agent" },
    { id: "search", label: "Web search", type: "tool" },
    { id: "answer", label: "Answer", type: "output" },
  ],
  edges: [
    { source: "user", target: "router", label: "prompt" },
    { source: "router", target: "rag" },
    { source: "router", target: "code" },
    { source: "router", target: "search" },
    { source: "rag", target: "answer" },
    { source: "code", target: "answer" },
    { source: "search", target: "answer" },
  ],
};

const knowledgeGraph: KnowledgeGraphSpec = {
  caption: "GraphRAG entiteter",
  nodes: [
    { id: "neo4j", label: "Neo4j", type: "database" },
    { id: "entity", label: "Entity", type: "concept" },
    { id: "doc", label: "Document", type: "source" },
    { id: "chunk", label: "Chunk", type: "concept" },
    { id: "embed", label: "Embedding", type: "tool" },
    { id: "agent", label: "Agent", type: "agent" },
  ],
  edges: [
    { source: "doc", target: "chunk", label: "split" },
    { source: "chunk", target: "embed", label: "vectorize" },
    { source: "chunk", target: "entity", label: "extract" },
    { source: "entity", target: "neo4j", label: "store" },
    { source: "embed", target: "neo4j", label: "index" },
    { source: "agent", target: "neo4j", label: "query" },
  ],
};

const brokenGraph = {
  // bevidst ugyldigt — skal vise GraphErrorBlock
  nodes: [{ id: "a" }, { id: "a", label: "dup" }],
  edges: [{ source: "a", target: "missing" }],
};

type CaseDef = {
  id: string;
  title: string;
  render: () => React.ReactNode;
};

const CASES: CaseDef[] = [
  { id: "linear", title: "Linear pipeline", render: () => <GraphBlock spec={linearGraph} /> },
  { id: "branching", title: "Branching agent graph", render: () => <GraphBlock spec={branchingGraph} /> },
  { id: "knowledge", title: "Knowledge graph", render: () => <KnowledgeGraphBlock spec={knowledgeGraph} /> },
  {
    id: "invalid",
    title: "Invalid spec → error block",
    render: () => (
      <GraphErrorBlock
        kind="graph"
        errors={validateGraphLikeSpec(brokenGraph)}
        raw={JSON.stringify(brokenGraph, null, 2)}
      />
    ),
  },
];

function Harness({ caseId, fs }: { caseId: string; fs: boolean }) {
  useEffect(() => {
    // Determinisme: dræb alle animationer + transitions globalt for snapshots.
    const style = document.createElement("style");
    style.id = "visual-harness-determinism";
    style.textContent = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .viz-graph-toolbar, .viz-graph-controls { opacity: 1 !important; }
    `;
    document.head.appendChild(style);
    document.documentElement.setAttribute("data-visual-harness", "ready");
    return () => {
      style.remove();
      document.documentElement.removeAttribute("data-visual-harness");
    };
  }, []);

  const found = CASES.find((c) => c.id === caseId) ?? CASES[0];

  if (fs) {
    return (
      <div style={{ minHeight: "100vh", padding: 24, background: "var(--background)" }}>
        <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }} data-testid="visual-fullscreen">
          {found.render()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "var(--background)" }}>
      <div style={{ width: 880, margin: "0 auto" }} data-testid="visual-stage" data-case={found.id}>
        <h1 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted-foreground)" }}>
          {found.title}
        </h1>
        <div style={{ marginTop: 16 }}>{found.render()}</div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/visual/graph")({
  validateSearch: (search: Record<string, unknown>) => ({
    case: typeof search.case === "string" ? search.case : "linear",
    fs: search.fs === "1" || search.fs === true,
  }),
  component: function VisualGraphRoute() {
    const { case: caseId, fs } = Route.useSearch();
    return <Harness caseId={caseId} fs={fs} />;
  },
});
