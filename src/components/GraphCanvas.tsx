import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import { Maximize2, Minus, Network, Plus } from "lucide-react";
import type { GraphEdge, GraphNode, GraphSpec, KnowledgeGraphSpec } from "@/lib/figureBlocks";
import { cn } from "@/lib/utils";

type Viewport = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
type PositionedNode = GraphNode & { x: number; y: number; colorVar: string; degree: number };

const NODE_W = 196;
const NODE_H = 74;
const GRAPH_COL_GAP = 292;
const GRAPH_ROW_GAP = 116;
const DEFAULT_VIEWPORT: Viewport = { scale: 1, x: 24, y: 24 };

function clampScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2.6, Math.max(0.35, value));
}

function edgeKey(edge: GraphEdge, index: number) {
  return edge.id ?? `${edge.source}-${edge.target}-${index}`;
}

function chartColorFor(index: number) {
  return `var(--chart-${(index % 5) + 1})`;
}

function computeDegrees(nodes: GraphNode[], edges: GraphEdge[]) {
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  return degree;
}

function assignGraphLayers(nodes: GraphNode[], edges: GraphEdge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map(nodes.map((n) => [n.id, [] as string[]]));
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) incoming.get(edge.target)!.push(edge.source);
  }
  const visiting = new Set<string>();
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const layer = parents.length ? Math.max(...parents.map((p) => visit(p) + 1)) : 0;
    visiting.delete(id);
    memo.set(id, layer);
    return layer;
  };
  nodes.forEach((node) => visit(node.id));
  return memo;
}

function layoutLayered(spec: GraphSpec, degree: Map<string, number>): PositionedNode[] {
  const layers = assignGraphLayers(spec.nodes, spec.edges);
  const groups = new Map<number, GraphNode[]>();
  for (const node of spec.nodes) {
    const layer = spec.layout === "manual" && node.x != null && node.y != null ? 0 : layers.get(node.id) ?? 0;
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer)!.push(node);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a - b);
  const maxRows = Math.max(1, ...ordered.map(([, ns]) => ns.length));
  const direction = spec.direction ?? "RIGHT";
  const maxLayer = Math.max(0, ordered.length - 1);
  const nodes: PositionedNode[] = [];

  ordered.forEach(([layer, group]) => {
    const sorted = [...group].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id));
    const yOffset = ((maxRows - sorted.length) * GRAPH_ROW_GAP) / 2;
    sorted.forEach((node, row) => {
      let x = node.x ?? layer * GRAPH_COL_GAP;
      let y = node.y ?? yOffset + row * GRAPH_ROW_GAP;
      if (direction === "LEFT") x = (maxLayer - layer) * GRAPH_COL_GAP;
      if (direction === "DOWN" || direction === "UP") {
        x = yOffset + row * GRAPH_ROW_GAP;
        y = layer * GRAPH_COL_GAP;
        if (direction === "UP") y = (maxLayer - layer) * GRAPH_COL_GAP;
      }
      nodes.push({ ...node, x, y, colorVar: chartColorFor(nodes.length), degree: degree.get(node.id) ?? 0 });
    });
  });
  return nodes;
}

function layoutKnowledge(spec: KnowledgeGraphSpec, degree: Map<string, number>): PositionedNode[] {
  const nodes = [...spec.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  if (spec.layout === "grid") {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((node, index) => ({
      ...node,
      x: (index % cols) * 236,
      y: Math.floor(index / cols) * 122,
      colorVar: chartColorFor(index),
      degree: degree.get(node.id) ?? 0,
    }));
  }
  if (spec.layout === "breadthfirst" || spec.layout === "dagre") {
    return layoutLayered({ ...spec, direction: "RIGHT", layout: "dagre" }, degree);
  }
  if (nodes.length === 1) {
    return [{ ...nodes[0], x: 160, y: 120, colorVar: chartColorFor(0), degree: degree.get(nodes[0].id) ?? 0 }];
  }
  const center = spec.layout === "circle" ? null : nodes[0];
  const orbit = center ? nodes.slice(1) : nodes;
  const radius = Math.max(190, Math.min(390, orbit.length * 32));
  const cx = radius + 220;
  const cy = radius + 160;
  const placed: PositionedNode[] = [];
  if (center) {
    placed.push({ ...center, x: cx - NODE_W / 2, y: cy - NODE_H / 2, colorVar: chartColorFor(0), degree: degree.get(center.id) ?? 0 });
  }
  orbit.forEach((node, i) => {
    const angle = -Math.PI / 2 + (i / orbit.length) * Math.PI * 2;
    placed.push({
      ...node,
      x: cx + Math.cos(angle) * radius - NODE_W / 2,
      y: cy + Math.sin(angle) * radius - NODE_H / 2,
      colorVar: chartColorFor(i + (center ? 1 : 0)),
      degree: degree.get(node.id) ?? 0,
    });
  });
  return placed;
}

function boundsOf(nodes: PositionedNode[]) {
  const minX = Math.min(...nodes.map((n) => n.x), 0);
  const minY = Math.min(...nodes.map((n) => n.y), 0);
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W), NODE_W);
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H), NODE_H);
  return { minX, minY, w: maxX - minX + 64, h: maxY - minY + 64 };
}

function anchor(node: PositionedNode, other: PositionedNode): { from: Point; to: Point } {
  const ac = { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 };
  const bc = { x: other.x + NODE_W / 2, y: other.y + NODE_H / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      from: { x: node.x + (dx > 0 ? NODE_W : 0), y: ac.y },
      to: { x: other.x + (dx > 0 ? 0 : NODE_W), y: bc.y },
    };
  }
  return {
    from: { x: ac.x, y: node.y + (dy > 0 ? NODE_H : 0) },
    to: { x: bc.x, y: other.y + (dy > 0 ? 0 : NODE_H) },
  };
}

export function GraphCanvas({
  spec,
  variant,
}: {
  spec: GraphSpec | KnowledgeGraphSpec;
  variant: "graph" | "knowledge";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [selectedId, setSelectedId] = useState<string | null>(spec.nodes[0]?.id ?? null);

  const { nodes, nodeMap, bounds } = useMemo(() => {
    const degree = computeDegrees(spec.nodes, spec.edges);
    const positioned = variant === "knowledge"
      ? layoutKnowledge(spec as KnowledgeGraphSpec, degree)
      : layoutLayered(spec as GraphSpec, degree);
    const b = boundsOf(positioned);
    const shifted = positioned.map((node) => ({ ...node, x: node.x - b.minX + 32, y: node.y - b.minY + 32 }));
    return { nodes: shifted, nodeMap: new Map(shifted.map((n) => [n.id, n])), bounds: { w: b.w, h: b.h } };
  }, [spec, variant]);

  const selected = selectedId ? nodeMap.get(selectedId) : null;
  const resetViewport = useCallback(() => setViewport(DEFAULT_VIEWPORT), []);
  const zoomBy = useCallback((factor: number) => {
    setViewport((current) => ({ ...current, scale: clampScale(current.scale * factor) }));
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    setViewport((current) => {
      const nextScale = clampScale(current.scale * Math.exp(-event.deltaY * 0.0012));
      const ratio = nextScale / current.scale;
      return { scale: nextScale, x: cx - ratio * (cx - current.x), y: cy - ratio * (cy - current.y) };
    });
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y };
  }, [viewport.x, viewport.y]);
  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setViewport((current) => ({ ...current, x: drag.vx + event.clientX - drag.x, y: drag.vy + event.clientY - drag.y }));
  }, []);
  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
  }, []);

  const height = Math.max(320, Math.min(620, spec.height ?? (variant === "knowledge" ? 460 : 400)));
  const label = variant === "knowledge" ? "Knowledge graph" : "Interactive graph";

  return (
    <figure className="aurora-figure aurora-figure--flat viz-graph-shell" data-variant={variant}>
      <div className="viz-graph-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="viz-graph-mark" aria-hidden><Network className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{spec.caption ?? label}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {spec.nodes.length} nodes · {spec.edges.length} relations
            </div>
          </div>
        </div>
        <div className="viz-graph-controls">
          <button type="button" onClick={() => zoomBy(1.16)} title="Zoom ind" aria-label="Zoom ind"><Plus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => zoomBy(1 / 1.16)} title="Zoom ud" aria-label="Zoom ud"><Minus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={resetViewport} title="Nulstil" aria-label="Nulstil"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="viz-graph-viewport"
        style={{ height }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="viz-graph-world"
          style={{
            width: bounds.w,
            height: bounds.h,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
        >
          <svg className="viz-graph-edges" width={bounds.w} height={bounds.h} aria-hidden>
            <defs>
              <marker id={`viz-arrow-${variant}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="viz-arrow-fill" />
              </marker>
            </defs>
            {spec.edges.map((edge, index) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;
              const { from, to } = anchor(source, target);
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              const dx = Math.abs(to.x - from.x);
              const d = dx > 20
                ? `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`;
              return (
                <g key={edgeKey(edge, index)} className="viz-edge">
                  <path d={d} markerEnd={`url(#viz-arrow-${variant})`} />
                  {edge.label && (
                    <foreignObject x={mx - 70} y={my - 13} width="140" height="26" className="viz-edge-label-wrap">
                      <div className="viz-edge-label">{edge.label}</div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
          {nodes.map((node) => {
            const active = selectedId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                className={cn("viz-node", active && "viz-node--selected")}
                style={{ left: node.x, top: node.y, ["--viz-node-color" as string]: node.colorVar } as CSSProperties}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(node.id);
                }}
                title={node.label ?? node.id}
              >
                <span className="viz-node-kicker">{node.type ?? (variant === "knowledge" ? "entity" : "node")}</span>
                <span className="viz-node-title">{node.label ?? node.id}</span>
                <span className="viz-node-meta">degree {node.degree}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="viz-graph-inspector">
          <span className="viz-inspector-dot" style={{ ["--viz-node-color" as string]: selected.colorVar } as CSSProperties} aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{selected.label ?? selected.id}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {selected.type ?? "node"} · {selected.degree} relationer
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}