/**
 * FlowFigure — Canvas Flowchart Design System (CFDS) renderer.
 *
 * Hver node er et React-kort der kan foldes ud. Edges tegnes som SVG-overlay
 * ud fra nodernes faktiske DOM-positioner og opdateres via ResizeObserver.
 *
 * Block-format (```flow ... ```):
 *   {
 *     "title": "RAG pipeline",
 *     "direction": "LR" | "TD",
 *     "nodes": [
 *       { "id": "u", "kind": "Agent", "label": "User",
 *         "summary": "Initiates query",
 *         "provenance": "ai", "confidence": 0.92,
 *         "regulatoryLevel": "guideline", "complianceScore": 0.81,
 *         "properties": { "Role": "End user" } }
 *     ],
 *     "edges": [{ "from": "u", "to": "q", "label": "asks", "kind": "TARGETS" }]
 *   }
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { z } from "zod";
import {
  ChevronRight,
  Bot,
  Wrench,
  FileText,
  ShieldAlert,
  AlertTriangle,
  GitBranch,
  Package,
  Database,
  Sparkles,
  Server,
  Plug,
  Lightbulb,
  FileSearch,
  FileCode,
  BrainCircuit,
  Terminal,
  BookOpen,
  Fingerprint,
  Shield,
  ArrowLeftRight,
  Route as RouteIcon,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────── *
 * §4 Node taxonomy — 17 canonical types + combo + query                       *
 * ────────────────────────────────────────────────────────────────────────── */

const CANONICAL_NODE_TYPES = [
  "Agent",
  "Artifact",
  "Claim",
  "CodeImplementation",
  "ComplianceGap",
  "Decision",
  "Entity",
  "Evidence",
  "GuardrailRule",
  "Insight",
  "KnowledgePattern",
  "MCPTool",
  "Memory",
  "StrategicInsight",
  "StrategicLeverage",
  "Tool",
  "Track",
  "combo",
  "query",
] as const;
export type CanvasNodeType = (typeof CANONICAL_NODE_TYPES)[number];

/** §4.2 Legacy aliases — normalized on input. */
const LEGACY_NODE_TYPE_MAP: Record<string, CanvasNodeType> = {
  agent: "Agent",
  tool: "Tool",
  claim: "Claim",
  thought: "Claim",
  evidence: "Evidence",
  risk: "GuardrailRule",
  gap: "ComplianceGap",
  decision: "Decision",
  artifact: "Artifact",
  system: "CodeImplementation",
  pattern: "KnowledgePattern",
  server: "CodeImplementation",
  endpoint: "MCPTool",
  pipeline: "Track",
  entity: "Entity",
  insight: "Insight",
  memory: "Memory",
};

function normalizeCanvasNodeType(raw: unknown): CanvasNodeType {
  if (typeof raw !== "string") return "Artifact";
  if ((CANONICAL_NODE_TYPES as readonly string[]).includes(raw)) return raw as CanvasNodeType;
  const lower = raw.toLowerCase();
  return LEGACY_NODE_TYPE_MAP[lower] ?? "Artifact";
}

/** §4.3 Families (10) — presentation grouping. */
type Family =
  | "knowledge"
  | "evidence"
  | "artifact"
  | "foundry"
  | "reasoning"
  | "capability"
  | "orchestration"
  | "memory"
  | "query"
  | "meta";

const FAMILY_MAP: Record<CanvasNodeType, Family> = {
  Agent: "orchestration",
  Track: "orchestration",
  Entity: "knowledge",
  Insight: "knowledge",
  StrategicInsight: "knowledge",
  Evidence: "evidence",
  Artifact: "artifact",
  Claim: "reasoning",
  Tool: "capability",
  MCPTool: "capability",
  CodeImplementation: "capability",
  Memory: "memory",
  query: "query",
  StrategicLeverage: "foundry",
  KnowledgePattern: "foundry",
  GuardrailRule: "foundry",
  Decision: "foundry",
  ComplianceGap: "foundry",
  combo: "meta",
};

/** §5.1 Visual identity per type. */
type Variant = "base" | "artifact" | "thought" | "query" | "foundry" | "combo";

interface NodeConfig {
  color: string;
  icon: LucideIcon;
  layer: string;
  variant: Variant;
}

const NODE_CONFIG: Record<CanvasNodeType, NodeConfig> = {
  CodeImplementation: { color: "#64748b", icon: Server, layer: "INFRA", variant: "base" },
  MCPTool: { color: "#14b8a6", icon: Plug, layer: "INFRA", variant: "base" },
  Tool: { color: "#667eea", icon: Wrench, layer: "CAPABILITY", variant: "base" },
  Track: { color: "#06b6d4", icon: GitBranch, layer: "ORCHESTRATION", variant: "base" },
  Agent: { color: "#e20074", icon: Bot, layer: "ORCHESTRATION", variant: "base" },
  Entity: { color: "#f4bb00", icon: Database, layer: "INTELLIGENCE", variant: "base" },
  Insight: { color: "#22c55e", icon: Lightbulb, layer: "INTELLIGENCE", variant: "base" },
  Evidence: { color: "#f97316", icon: FileSearch, layer: "INTELLIGENCE", variant: "base" },
  Artifact: { color: "#ec4899", icon: FileCode, layer: "INTELLIGENCE", variant: "artifact" },
  Claim: { color: "#8b5cf6", icon: BrainCircuit, layer: "REASONING", variant: "thought" },
  query: { color: "#a855f7", icon: Terminal, layer: "SANDBOX", variant: "query" },
  StrategicLeverage: { color: "#0ea5e9", icon: BookOpen, layer: "FOUNDRY", variant: "foundry" },
  KnowledgePattern: { color: "#6366f1", icon: Fingerprint, layer: "FOUNDRY", variant: "foundry" },
  GuardrailRule: { color: "#ef4444", icon: Shield, layer: "FOUNDRY", variant: "foundry" },
  Decision: { color: "#06b6d4", icon: ArrowLeftRight, layer: "FOUNDRY", variant: "foundry" },
  ComplianceGap: { color: "#f59e0b", icon: RouteIcon, layer: "FOUNDRY", variant: "foundry" },
  StrategicInsight: { color: "#22c55e", icon: Sparkles, layer: "INTELLIGENCE", variant: "base" },
  Memory: { color: "#8b5cf6", icon: BrainCircuit, layer: "MEMORY", variant: "thought" },
  combo: { color: "#6b7280", icon: Layers, layer: "META", variant: "combo" },
};

/** §5.3 Provenance badges. */
const PROVENANCE_BADGE: Record<string, { icon: string; label: string }> = {
  query: { icon: "🔍", label: "Query" },
  ai: { icon: "🤖", label: "AI" },
  expand: { icon: "🔗", label: "Expand" },
  tool: { icon: "🛠", label: "Tool" },
  manual: { icon: "✋", label: "Manual" },
  harvest: { icon: "🌐", label: "Harvest" },
  pipeline: { icon: "⚙", label: "Pipeline" },
};

/** §4.7 Regulatory levels. */
const REGULATORY_COLOR: Record<string, string> = {
  strict: "#f4bb00",
  guideline: "#3b82f6",
  info: "#6b7280",
};
function normalizeRegulatoryLevel(raw: string): keyof typeof REGULATORY_COLOR {
  const l = raw.toLowerCase();
  if (l === "critical" || l === "strict") return "strict";
  if (l === "warning" || l === "high" || l === "guideline") return "guideline";
  return "info";
}

/** §5.3 Confidence → opacity. */
function confidenceStyle(c?: number): { opacity: number; dashed: boolean } {
  if (c === undefined) return { opacity: 1, dashed: false };
  if (c >= 0.9) return { opacity: 1, dashed: false };
  if (c >= 0.7) return { opacity: 0.85, dashed: false };
  if (c >= 0.4) return { opacity: 0.7, dashed: true };
  return { opacity: 0.6, dashed: true };
}

/** §5.3 Compliance bar color thresholds. */
function complianceColor(s: number): string {
  if (s >= 0.8) return "#22c55e";
  if (s >= 0.5) return "#eab308";
  return "#ef4444";
}

/** §8 Swimlane columns (subset of ENGAGEMENT_COLUMNS — colors only). */
const LANE_COLORS: Record<string, string> = {
  VISION: "#f4bb00",
  PILLARS: "#22c55e",
  MARKET: "#3b82f6",
  GAPS: "#f97316",
  H5_MIDPOINT: "#8b5cf6",
  H3_MOMENTUM: "#a855f7",
  H1_LAUNCH: "#ec4899",
  RISKS: "#ef4444",
  FINANCE: "#14b8a6",
  ACTION_PLAN: "#06b6d4",
  BRIEF: "#64748b",
  HYPOTHESES: "#8b5cf6",
  EVIDENCE: "#f97316",
  ANALYSIS: "#22c55e",
  RECOMMENDATIONS: "#0047bb",
  DELIVERABLES: "#ec4899",
};

/** §8 Canonical lane order — lanes not in this list are appended alphabetically. */
const LANE_ORDER: string[] = [
  "VISION",
  "PILLARS",
  "MARKET",
  "GAPS",
  "H5_MIDPOINT",
  "H3_MOMENTUM",
  "H1_LAUNCH",
  "RISKS",
  "FINANCE",
  "ACTION_PLAN",
  "BRIEF",
  "HYPOTHESES",
  "EVIDENCE",
  "ANALYSIS",
  "RECOMMENDATIONS",
  "DELIVERABLES",
];
const FALLBACK_LANE_COLOR = "#64748b";
function laneRank(key: string): number {
  const i = LANE_ORDER.indexOf(key);
  return i === -1 ? LANE_ORDER.length : i;
}

/** §6.2 Canonical relationship types. */
const RELATIONSHIP_TYPES = [
  "CONSTRAINS",
  "IMPLEMENTS",
  "LEVERAGES",
  "RELATED_TO",
  "REMEDIATES",
  "TARGETS",
] as const;

/* ────────────────────────────────────────────────────────────────────────── *
 * Schema                                                                      *
 * ────────────────────────────────────────────────────────────────────────── */

const FlowNodeMode = z.enum([
  "card",
  "outline",
  "canvas_block",
  "stepper",
  "checklist",
  "code",
  "document",
  "slides",
  "diagram",
  "graph",
  "split",
  "inspector",
  "timeline",
  "risk_overlay",
  "diff",
]);

const ProvenanceObject = z.object({
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
const ProvenanceField = z.union([z.string(), ProvenanceObject]);

const FlowNodeSchemaCamel = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().optional(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  provenance: ProvenanceField.optional(),
  confidence: z.number().min(0).max(1).optional(),
  regulatoryLevel: z.string().optional(),
  complianceScore: z.number().min(0).max(1).optional(),
  lane: z.string().optional(),
  nodeFamily: z.string().optional(),
  modes: z.array(FlowNodeMode).optional(),
});

const FlowEdgeSchemaCamel = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  kind: z.enum(RELATIONSHIP_TYPES).optional(),
  weight: z.number().min(0).optional(),
});

const FlowSpecSchemaCamel = z.object({
  title: z.string().optional(),
  direction: z.enum(["LR", "TD"]).default("LR"),
  nodes: z.array(FlowNodeSchemaCamel).min(1),
  edges: z.array(FlowEdgeSchemaCamel).default([]),
});

// Snake_case → camelCase normalisering. Spec'en kræver snake_case wire-format
// (jf. wt-contracts/CONTRACT_VIOLATION 484fbefe), men intern model er camelCase.
const SNAKE_TO_CAMEL_NODE: Record<string, string> = {
  node_type: "kind",
  node_family: "nodeFamily",
  regulatory_level: "regulatoryLevel",
  compliance_score: "complianceScore",
};
const SNAKE_TO_CAMEL_PROV: Record<string, string> = {
  created_by: "createdBy",
  created_at: "createdAt",
};

function normalizeKeys(obj: unknown, map: Record<string, string>): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

function normalizeSpec(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const root = input as Record<string, unknown>;
  const nodes = Array.isArray(root.nodes)
    ? root.nodes.map((n) => {
        const norm = normalizeKeys(n, SNAKE_TO_CAMEL_NODE) as Record<string, unknown>;
        if (norm.provenance && typeof norm.provenance === "object") {
          norm.provenance = normalizeKeys(norm.provenance, SNAKE_TO_CAMEL_PROV);
        }
        return norm;
      })
    : root.nodes;
  return { ...root, nodes };
}

export const FlowSpecSchema = FlowSpecSchemaCamel;
export type FlowSpec = z.infer<typeof FlowSpecSchemaCamel>;
export type FlowNode = z.infer<typeof FlowNodeSchemaCamel>;
export type FlowEdge = z.infer<typeof FlowEdgeSchemaCamel>;

export function parseFlowSpec(raw: string): { spec: FlowSpec | null; error?: string } {
  try {
    const json = JSON.parse(raw);
    const normalized = normalizeSpec(json);
    const parsed = FlowSpecSchemaCamel.safeParse(normalized);
    if (!parsed.success) return { spec: null, error: parsed.error.message };
    return { spec: parsed.data };
  } catch (e) {
    return { spec: null, error: e instanceof Error ? e.message : "invalid JSON" };
  }
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Layout helper — topological layer assignment                                *
 * ────────────────────────────────────────────────────────────────────────── */

function assignLayers(spec: FlowSpec): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const n of spec.nodes) incoming.set(n.id, []);
  for (const e of spec.edges) {
    if (incoming.has(e.to) && incoming.has(e.from)) incoming.get(e.to)!.push(e.from);
  }
  const layer = new Map<string, number>();
  const visit = (id: string, stack = new Set<string>()): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const preds = incoming.get(id) ?? [];
    const l = preds.length === 0 ? 0 : Math.max(...preds.map((p) => visit(p, stack) + 1));
    stack.delete(id);
    layer.set(id, l);
    return l;
  };
  for (const n of spec.nodes) visit(n.id);
  return layer;
}

/**
 * §7.1 Eigenvector centrality — power iteration (16×) over weighted adjacency.
 * Returnerer score per node. Bruges til at sortere noder inden for samme
 * topologiske layer/lane så de mest centrale placeres først.
 */
function computeEigenvectorScores(spec: FlowSpec, iterations = 16): Map<string, number> {
  const ids = spec.nodes.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  if (n === 0) return new Map();
  const adj: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const degree = new Array(n).fill(0);
  for (const e of spec.edges) {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    const w = e.weight ?? 1;
    adj[a][b] += w;
    adj[b][a] += w; // symmetrisk for centralitet
    degree[a] += w;
    degree[b] += w;
  }
  let v = new Array(n).fill(1 / Math.sqrt(n));
  for (let k = 0; k < iterations; k++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += adj[i][j] * v[j];
      next[i] = s;
    }
    // weighted-degree boost (jf. spec §7.1)
    for (let i = 0; i < n; i++) next[i] += degree[i] * 0.05;
    const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)) || 1;
    v = next.map((x) => x / norm);
  }
  const out = new Map<string, number>();
  ids.forEach((id, i) => out.set(id, v[i]));
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── *
 * NodeCard                                                                    *
 * ────────────────────────────────────────────────────────────────────────── */

type Rect = { x: number; y: number; w: number; h: number };

function NodeCard({
  node,
  expanded,
  onToggle,
  registerRef,
}: {
  node: FlowNode;
  expanded: boolean;
  onToggle: () => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}) {
  const type = normalizeCanvasNodeType(node.kind);
  const cfg = NODE_CONFIG[type];
  const family = FAMILY_MAP[type];
  const Icon = cfg.icon;
  const propEntries = node.properties ? Object.entries(node.properties) : [];
  const conf = confidenceStyle(
    node.confidence ??
      (typeof node.provenance === "object" ? node.provenance.confidence : undefined),
  );
  const provKey = typeof node.provenance === "string" ? node.provenance : node.provenance?.source;
  const prov = provKey ? PROVENANCE_BADGE[provKey.toLowerCase()] : undefined;
  const provConfidence =
    typeof node.provenance === "object" ? node.provenance.confidence : undefined;
  const effectiveConfidence = node.confidence ?? provConfidence;
  const reg = node.regulatoryLevel ? normalizeRegulatoryLevel(node.regulatoryLevel) : undefined;
  const regColor = reg ? REGULATORY_COLOR[reg] : undefined;
  const compColor =
    node.complianceScore !== undefined ? complianceColor(node.complianceScore) : undefined;

  const style: CSSProperties = {
    ["--flow-color" as string]: cfg.color,
    opacity: conf.opacity,
  };

  return (
    <div
      ref={(el) => registerRef(node.id, el)}
      data-flow-node={node.id}
      data-variant={cfg.variant}
      data-family={family}
      className={cn(
        "flow-node group relative rounded-lg bg-card text-card-foreground shadow-sm transition-all",
        `flow-variant-${cfg.variant}`,
        conf.dashed && "flow-node-dashed",
      )}
      style={style}
      title={`${type} · ${cfg.layer}`}
    >
      {cfg.variant === "foundry" && (
        <span className="flow-foundry-pill" aria-hidden>
          FOUNDRY
        </span>
      )}
      {(prov || regColor) && (
        <span className="flow-overlay-row">
          {prov && (
            <span
              className="flow-provenance"
              title={`Provenance: ${prov.label}`}
              aria-label={prov.label}
            >
              {prov.icon}
            </span>
          )}
          {regColor && reg && (
            <span
              className="flow-regulatory"
              title={`Regulatory: ${reg}`}
              style={{
                color: regColor,
                background: `color-mix(in oklab, ${regColor} 20%, transparent)`,
                borderColor: `color-mix(in oklab, ${regColor} 40%, transparent)`,
              }}
            >
              {reg}
            </span>
          )}
        </span>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent/40"
        aria-expanded={expanded}
      >
        <span className="flow-node-icon flex h-7 w-7 items-center justify-center rounded-md">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{node.label}</span>
          {node.subtitle && (
            <span className="truncate text-[11px] font-medium text-muted-foreground/90">
              {node.subtitle}
            </span>
          )}
          {node.summary && !expanded && !node.subtitle && (
            <span className="truncate text-xs text-muted-foreground">{node.summary}</span>
          )}
          {node.modes && node.modes.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {node.modes.slice(0, 4).map((m) => (
                <span
                  key={m}
                  className="rounded-sm border border-border/60 bg-muted/40 px-1 py-px text-[9px] uppercase tracking-wider text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="flow-layer-pill">{cfg.layer}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-border/60 px-3 py-2 text-xs">
          {node.summary && <p className="mb-2 text-muted-foreground">{node.summary}</p>}
          {propEntries.length > 0 ? (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              {propEntries.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-muted-foreground">{k}</dt>
                  <dd className="break-words text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            !node.summary && <p className="italic text-muted-foreground">Ingen yderligere data</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Type: {type}</span>
            <span>Family: {family}</span>
            {node.confidence !== undefined && (
              <span>Confidence: {Math.round(node.confidence * 100)}%</span>
            )}
          </div>
        </div>
      )}
      {compColor !== undefined && node.complianceScore !== undefined && (
        <div
          className="flow-compliance-bar"
          aria-label={`Compliance ${Math.round(node.complianceScore * 100)}%`}
        >
          <span
            style={{ width: `${Math.max(4, node.complianceScore * 100)}%`, background: compColor }}
          />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
 * FlowFigure                                                                  *
 * ────────────────────────────────────────────────────────────────────────── */

export function FlowFigure({ content }: { content: string }) {
  const parsed = useMemo(() => parseFlowSpec(content), [content]);
  const spec = parsed.spec;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [rects, setRects] = useState<Map<string, Rect>>(new Map());
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    setContainerSize({ w: container.clientWidth, h: container.clientHeight });
    const next = new Map<string, Rect>();
    nodeRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left - cRect.left, y: r.top - cRect.top, w: r.width, h: r.height });
    });
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, expanded, spec]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    nodeRefs.current.forEach((el) => ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, spec]);

  const layers = useMemo(() => (spec ? assignLayers(spec) : new Map<string, number>()), [spec]);
  const centrality = useMemo(
    () => (spec ? computeEigenvectorScores(spec) : new Map<string, number>()),
    [spec],
  );
  const sortByCentrality = useCallback(
    (a: FlowNode, b: FlowNode) => (centrality.get(b.id) ?? 0) - (centrality.get(a.id) ?? 0),
    [centrality],
  );

  /** Group by lane if any node has lane, otherwise by topological layer. */
  const { groups, lanesUsed } = useMemo(() => {
    if (!spec)
      return {
        groups: [] as { key: string; color?: string; nodes: FlowNode[] }[],
        lanesUsed: false,
      };
    const hasLanes = spec.nodes.some((n) => n.lane);
    if (hasLanes) {
      const map = new Map<string, FlowNode[]>();
      for (const n of spec.nodes) {
        const k = n.lane ?? "—";
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(n);
      }
      return {
        lanesUsed: true,
        groups: [...map.entries()]
          .sort(([a], [b]) => laneRank(a) - laneRank(b) || a.localeCompare(b))
          .map(([k, ns]) => ({
            key: k,
            color: LANE_COLORS[k] ?? FALLBACK_LANE_COLOR,
            nodes: [...ns].sort(sortByCentrality),
          })),
      };
    }
    const map = new Map<number, FlowNode[]>();
    for (const n of spec.nodes) {
      const l = layers.get(n.id) ?? 0;
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(n);
    }
    return {
      lanesUsed: false,
      groups: [...map.entries()]
        .sort(([a], [b]) => a - b)
        .map(([l, ns]) => ({
          key: `L${l}`,
          color: undefined as string | undefined,
          nodes: [...ns].sort(sortByCentrality),
        })),
    };
  }, [spec, layers, sortByCentrality]);

  if (!spec) {
    return (
      <figure className="aurora-figure">
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="mb-1 font-medium text-destructive">Ugyldig flow-blok</p>
          <p className="text-muted-foreground">{parsed.error}</p>
          <pre className="mt-2 overflow-auto rounded bg-muted/30 p-2 text-[11px]">{content}</pre>
        </div>
      </figure>
    );
  }

  const isLR = spec.direction === "LR";

  return (
    <figure className="aurora-figure flow-figure">
      {spec.title && (
        <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {spec.title}
        </figcaption>
      )}
      <div
        ref={containerRef}
        className={cn(
          "relative gap-6 rounded-lg border border-border/60 bg-background/40 p-4",
          isLR ? "flex flex-row items-start overflow-x-auto" : "flex flex-col",
        )}
      >
        {/* §6 SVG edge-overlay */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-[#94a3b8]"
          width={containerSize.w}
          height={containerSize.h}
          aria-hidden
        >
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>
          <g>
            {spec.edges.map((e, i) => {
              const a = rects.get(e.from);
              const b = rects.get(e.to);
              if (!a || !b) return null;
              const fromX = isLR ? a.x + a.w : a.x + a.w / 2;
              const fromY = isLR ? a.y + a.h / 2 : a.y + a.h;
              const toX = isLR ? b.x : b.x + b.w / 2;
              const toY = isLR ? b.y + b.h / 2 : b.y;
              const midX = isLR ? (fromX + toX) / 2 : fromX;
              const midY = isLR ? fromY : (fromY + toY) / 2;
              const d = isLR
                ? `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`
                : `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
              const labelX = (fromX + toX) / 2;
              const labelY = (fromY + toY) / 2;
              return (
                <g key={i}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#334155"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    className="flow-edge-path"
                    markerEnd="url(#flow-arrow)"
                  />
                  {e.label && (
                    <g>
                      <rect
                        x={labelX - (e.label.length * 3.2 + 6)}
                        y={labelY - 9}
                        width={e.label.length * 6.4 + 12}
                        height={14}
                        rx={4}
                        fill="#0f1d32"
                        fillOpacity={0.85}
                      />
                      <text
                        x={labelX}
                        y={labelY + 1}
                        textAnchor="middle"
                        className="fill-[#94a3b8] text-[10px] font-medium"
                      >
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {groups.map((group) => (
          <div
            key={group.key}
            className={cn(
              "relative z-10 flex gap-3",
              isLR ? "flex-col" : "flex-row flex-wrap",
              isLR ? "min-w-[240px]" : "w-full",
              lanesUsed && "flow-lane",
              lanesUsed && (isLR ? "flow-lane-vertical" : "flow-lane-horizontal"),
            )}
            style={
              lanesUsed && group.color
                ? ({ ["--lane-color" as never]: group.color } as React.CSSProperties)
                : undefined
            }
            data-lane={lanesUsed ? group.key : undefined}
          >
            {lanesUsed && (
              <div className="flow-lane-header text-[10px] font-semibold uppercase tracking-wider">
                <span className="flow-lane-dot" aria-hidden />
                {group.key.replace(/_/g, " ")}
                <span className="flow-lane-count">{group.nodes.length}</span>
              </div>
            )}
            {group.nodes.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                expanded={!!expanded[n.id]}
                onToggle={() => setExpanded((prev) => ({ ...prev, [n.id]: !prev[n.id] }))}
                registerRef={registerRef}
              />
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}
