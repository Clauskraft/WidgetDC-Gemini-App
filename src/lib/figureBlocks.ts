/**
 * Fence-baseret kontrakt for grafiske blokke i AI-svar.
 *
 *   ```chart
 *   { "kind": "bar", "data": [...], "series": [{ "key": "value", "label": "Omsætning" }],
 *     "xKey": "label", "legendPosition": "bottom", "caption": "Q1–Q4" }
 *   ```
 *   ```mermaid
 *   graph TD; A-->B
 *   ```
 *   ```clak / ```ckak behandles som Mermaid-aliaser.
 *   ```svg
 *   <svg viewBox="0 0 100 100">...</svg>
 *   ```
 *   ```figure
 *   ![](url) — caption tekst
 *   ```
 *
 * Alt udenfor fences er almindelig markdown og rendres via ReactMarkdown.
 */

export type ChartKind = "bar" | "line" | "area" | "pie";

export type ChartSpec = {
  kind: ChartKind;
  data: Array<Record<string, unknown>>;
  series?: Array<{ key: string; label?: string }>;
  xKey?: string;
  legendPosition?: "top" | "bottom" | "left" | "right";
  caption?: string;
  height?: number;
};

export type GraphNode = {
  id: string;
  label?: string;
  type?: string;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
};
export type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
};
export type GraphSpec = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: "elk-layered" | "elk-mrtree" | "elk-force" | "dagre" | "manual";
  direction?: "RIGHT" | "DOWN" | "LEFT" | "UP";
  caption?: string;
  height?: number;
};
export type KnowledgeGraphSpec = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: "cose" | "cose-bilkent" | "dagre" | "concentric" | "breadthfirst" | "circle" | "grid";
  caption?: string;
  height?: number;
};

export type GraphErrorKind = "graph" | "knowledge-graph";

export type Block =
  | { type: "text"; content: string }
  | { type: "chart"; spec: ChartSpec; raw: string }
  | { type: "flow"; content: string }
  | { type: "mermaid"; content: string }
  | { type: "svg"; content: string }
  | { type: "figure"; content: string }
  | { type: "graph"; spec: GraphSpec; raw: string }
  | { type: "knowledge-graph"; spec: KnowledgeGraphSpec; raw: string }
  | { type: "graph-error"; kind: GraphErrorKind; errors: string[]; raw: string };

/**
 * Validér et {nodes, edges}-spec. Returnerer en liste af menneskelæselige
 * fejl. Tom liste = gyldigt spec. Bruges af både graph- og knowledge-graph
 * fences så LLM-fejl bliver synlige i UI i stedet for at fejle stille.
 */
export function validateGraphLikeSpec(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("Spec skal være et JSON-objekt med 'nodes' og 'edges'.");
    return errors;
  }
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.nodes)) errors.push("'nodes' mangler eller er ikke et array.");
  if (!Array.isArray(obj.edges)) errors.push("'edges' mangler eller er ikke et array.");
  if (errors.length > 0) return errors;

  const nodes = obj.nodes as unknown[];
  const edges = obj.edges as unknown[];
  if (nodes.length === 0) errors.push("'nodes' er tomt — der skal mindst være én node.");

  const ids = new Set<string>();
  nodes.forEach((n, i) => {
    if (!n || typeof n !== "object") {
      errors.push(`Node[${i}] er ikke et objekt.`);
      return;
    }
    const id = (n as Record<string, unknown>).id;
    if (typeof id !== "string" || !id) {
      errors.push(`Node[${i}] mangler gyldigt 'id' (string).`);
      return;
    }
    if (ids.has(id)) errors.push(`Node[${i}] har duplikeret id '${id}'.`);
    ids.add(id);
  });

  edges.forEach((e, i) => {
    if (!e || typeof e !== "object") {
      errors.push(`Edge[${i}] er ikke et objekt.`);
      return;
    }
    const { source, target } = e as Record<string, unknown>;
    if (typeof source !== "string" || !source) errors.push(`Edge[${i}] mangler 'source' (string).`);
    else if (ids.size > 0 && !ids.has(source)) errors.push(`Edge[${i}].source '${source}' findes ikke i nodes.`);
    if (typeof target !== "string" || !target) errors.push(`Edge[${i}] mangler 'target' (string).`);
    else if (ids.size > 0 && !ids.has(target)) errors.push(`Edge[${i}].target '${target}' findes ikke i nodes.`);
  });

  return errors;
}

function normalizeGraphLikeSpec<T extends GraphSpec | KnowledgeGraphSpec>(value: unknown): T {
  const obj = value as Record<string, unknown>;
  const edges = Array.isArray(obj.edges)
    ? obj.edges.map((edge) => {
        if (!edge || typeof edge !== "object") return edge;
        const e = edge as Record<string, unknown>;
        return {
          ...e,
          source: typeof e.source === "string" ? e.source : e.from,
          target: typeof e.target === "string" ? e.target : e.to,
        };
      })
    : obj.edges;
  return { ...obj, edges } as T;
}

const FENCE_RE = /^([ \t]*)```(chart|flow|mermaid|clak|ckak|svg|figure|graph|knowledge-graph|kg)\b[^\n]*\n([\s\S]*?)\n\1```/gim;

export function parseBlocks(text: string): Block[] {
  if (!text) return [];
  const blocks: Block[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const slice = text.slice(lastIndex, m.index).replace(/\n+$/, "");
      if (slice.trim()) blocks.push({ type: "text", content: slice });
    }
    const [, , rawLang, body] = m;
    const lang = rawLang.toLowerCase();
    if (lang === "chart") {
      try {
        const spec = JSON.parse(body) as ChartSpec;
        blocks.push({ type: "chart", spec, raw: body });
      } catch {
        blocks.push({ type: "text", content: "```json\n" + body + "\n```" });
      }
    } else if (lang === "flow") {
      // Aurora-internt JSON-format
      blocks.push({ type: "flow", content: body });
    } else if (lang === "mermaid" || lang === "clak" || lang === "ckak") {
      // Mermaid + Aurora-aliaser → renderes via mermaid.js
      blocks.push({ type: "mermaid", content: body });
    } else if (lang === "svg") {
      blocks.push({ type: "svg", content: body });
    } else if (lang === "figure") {
      blocks.push({ type: "figure", content: body });
    } else if (lang === "graph") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        blocks.push({
          type: "graph-error",
          kind: "graph",
          errors: [`Ugyldig JSON: ${(err as Error).message}`],
          raw: body,
        });
        lastIndex = m.index + m[0].length;
        continue;
      }
      const normalized = normalizeGraphLikeSpec<GraphSpec>(parsed);
      const errors = validateGraphLikeSpec(normalized);
      if (errors.length === 0) {
        blocks.push({ type: "graph", spec: normalized, raw: body });
      } else {
        blocks.push({ type: "graph-error", kind: "graph", errors, raw: body });
      }
    } else if (lang === "knowledge-graph" || lang === "kg") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        blocks.push({
          type: "graph-error",
          kind: "knowledge-graph",
          errors: [`Ugyldig JSON: ${(err as Error).message}`],
          raw: body,
        });
        lastIndex = m.index + m[0].length;
        continue;
      }
      const normalized = normalizeGraphLikeSpec<KnowledgeGraphSpec>(parsed);
      const errors = validateGraphLikeSpec(normalized);
      if (errors.length === 0) {
        blocks.push({ type: "knowledge-graph", spec: normalized, raw: body });
      } else {
        blocks.push({ type: "graph-error", kind: "knowledge-graph", errors, raw: body });
      }
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).replace(/^\n+/, "");
    if (tail.trim()) blocks.push({ type: "text", content: tail });
  }
  if (blocks.length === 0) blocks.push({ type: "text", content: text });
  return blocks;
}

/**
 * Detektér en numerisk markdown-tabel og udled en ChartSpec (bar) til auto-promotion.
 * Returnerer null hvis tabellen ikke er numerisk eller har upassende dimensioner.
 */
export function tableToChartSpec(markdownTable: string): ChartSpec | null {
  const lines = markdownTable.trim().split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) return null;
  const parseRow = (l: string) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const header = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);
  if (header.length < 2 || header.length > 6) return null;
  const xKey = header[0];
  const seriesKeys = header.slice(1);
  const data = rows
    .map((r) => {
      const obj: Record<string, unknown> = { [xKey]: r[0] };
      let allNumeric = true;
      seriesKeys.forEach((k, i) => {
        const raw = (r[i + 1] ?? "").replace(/[,\s%]/g, "");
        const n = Number(raw);
        if (!Number.isFinite(n)) allNumeric = false;
        obj[k] = n;
      });
      return allNumeric ? obj : null;
    })
    .filter(Boolean) as Array<Record<string, unknown>>;
  if (data.length < 2) return null;
  return {
    kind: "bar",
    data,
    xKey,
    series: seriesKeys.map((k) => ({ key: k, label: k })),
  };
}
