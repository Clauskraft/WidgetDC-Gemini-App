import { useMemo, useState, type JSX } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";

// Normalisér markdown-tabeller: LLM'er indsætter ofte tomme linjer mellem rækker,
// hvilket bryder GFM-tabel-parsing. Vi fjerner tomme linjer mellem pipe-linjer.
function normalizeTables(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      const prev = out[out.length - 1] ?? "";
      const next = lines[i + 1] ?? "";
      if (/^\s*\|.*\|\s*$/.test(prev) && /^\s*\|.*\|\s*$/.test(next)) {
        // skip blank line mellem tabel-rækker
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

const REMARK_PLUGINS = [remarkGfm];
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Chart, CHART_SERIES_VARS } from "@/components/Chart";
import { parseBlocks, tableToChartSpec, type ChartSpec, type Block } from "@/lib/figureBlocks";
import { FlowFigure } from "@/components/FlowFigure";
import { MermaidBlock } from "@/components/MermaidBlock";
import { MindmapBlock } from "@/components/MindmapBlock";
import { GraphBlock } from "@/components/GraphBlock";
import { KnowledgeGraphBlock } from "@/components/KnowledgeGraphBlock";
import { GraphErrorBlock } from "@/components/GraphErrorBlock";

function ChartBlock({ spec }: { spec: ChartSpec }) {
  const {
    kind,
    data,
    series = [],
    xKey = "label",
    legendPosition = "bottom",
    caption,
    height = 240,
  } = spec;
  const legend = series.map((s, i) => ({
    label: s.label ?? s.key,
    series: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  }));

  let inner: React.ReactElement;
  if (kind === "pie") {
    inner = (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip />
          <Pie data={data} dataKey={series[0]?.key ?? "value"} nameKey={xKey} outerRadius="75%">
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_SERIES_VARS[i % 5]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  } else {
    const Wrapper = kind === "line" ? LineChart : kind === "area" ? AreaChart : BarChart;
    inner = (
      <ResponsiveContainer width="100%" height={height}>
        <Wrapper data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--figure-grid)" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="var(--figure-axis)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--figure-axis)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend />
          {series.map((s, i) =>
            kind === "line" ? (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={CHART_SERIES_VARS[i % 5]}
                strokeWidth={2}
                dot={false}
              />
            ) : kind === "area" ? (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={CHART_SERIES_VARS[i % 5]}
                fill={CHART_SERIES_VARS[i % 5]}
                fillOpacity={0.25}
              />
            ) : (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                fill={CHART_SERIES_VARS[i % 5]}
                radius={[4, 4, 0, 0]}
              />
            ),
          )}
        </Wrapper>
      </ResponsiveContainer>
    );
  }

  return (
    <Chart legend={legend} legendPosition={legendPosition} caption={caption}>
      {inner}
    </Chart>
  );
}

// FlowFigure lever i src/components/FlowFigure.tsx

function SvgBlock({ content }: { content: string }) {
  const clean = useMemo(() => {
    if (typeof window === "undefined") return "";
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  }, [content]);
  return (
    <figure className="aurora-figure">
      <div className="aurora-chart" dangerouslySetInnerHTML={{ __html: clean }} />
    </figure>
  );
}

const markdownTableComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto rounded-lg border border-border shadow-soft">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 border-b border-border/60 text-foreground" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="transition-colors hover:bg-accent/30" {...props}>
      {children}
    </tr>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border/40" {...props}>
      {children}
    </tbody>
  ),
};

function FigureBlock({ content }: { content: string }) {
  const normalized = useMemo(() => normalizeTables(content), [content]);
  return (
    <figure className="aurora-figure">
      <div className="prose prose-sm prose-aurora max-w-none">
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{normalized}</ReactMarkdown>
      </div>
    </figure>
  );
}

function TextBlock({ content }: { content: string }) {
  const normalized = useMemo(() => normalizeTables(content), [content]);
  // Detektér markdown-tabel og tilbyd auto-promotion til diagram.
  const tableMatch = normalized.match(/(^\|.+\|\n\|[\s\-:|]+\|\n(?:\|.+\|\n?)+)/m);
  const [asChart, setAsChart] = useState(false);
  const spec = useMemo(() => (tableMatch ? tableToChartSpec(tableMatch[1]) : null), [tableMatch]);

  if (spec && tableMatch) {
    const before = normalized.slice(0, tableMatch.index ?? 0);
    const after = normalized.slice((tableMatch.index ?? 0) + tableMatch[1].length);
    return (
      <div className="prose prose-sm prose-aurora max-w-none">
        {before && <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{before}</ReactMarkdown>}
        <div className="not-prose my-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setAsChart((v) => !v)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              {asChart ? "Vis som tabel" : "Vis som diagram"}
            </button>
          </div>
          {asChart ? (
            <ChartBlock spec={spec} />
          ) : (
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownTableComponents}>
              {tableMatch[1]}
            </ReactMarkdown>
          )}
        </div>
        {after && <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{after}</ReactMarkdown>}
      </div>
    );
  }

  return (
    <div className="prose prose-sm prose-aurora max-w-none">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{normalized}</ReactMarkdown>
    </div>
  );
}

export function MessageContent({
  text,
  layout = "stack",
}: {
  text: string;
  layout?: "stack" | "canvas";
}) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const isCanvas = layout === "canvas";
  const containerCls = isCanvas ? "aurora-canvas" : "flex flex-col gap-3";
  const spanFor = (t: Block["type"]): string | undefined => {
    if (!isCanvas) return undefined;
    if (
      t === "chart" ||
      t === "flow" ||
      t === "mermaid" ||
      t === "mindmap" ||
      t === "svg" ||
      t === "graph" ||
      t === "knowledge-graph"
    )
      return "wide";
    if (t === "figure") return "tall";
    return "full"; // text fylder hele bredden så det ikke overlapper grafik
  };
  return (
    <div className={containerCls}>
      {blocks.map((b, i) => {
        const span = spanFor(b.type);
        const wrap = (node: React.ReactNode) =>
          isCanvas ? (
            <div key={i} data-span={span}>
              {node}
            </div>
          ) : (
            <div key={i}>{node}</div>
          );
        switch (b.type) {
          case "chart":
            return wrap(<ChartBlock spec={b.spec} />);
          case "flow":
            return wrap(<FlowFigure content={b.content} />);
          case "mermaid":
            return wrap(<MermaidBlock content={b.content} />);
          case "mindmap":
            return wrap(<MindmapBlock content={b.content} />);
          case "svg":
            return wrap(<SvgBlock content={b.content} />);
          case "figure":
            return wrap(<FigureBlock content={b.content} />);
          case "graph":
            return wrap(<GraphBlock spec={b.spec} />);
          case "knowledge-graph":
            return wrap(<KnowledgeGraphBlock spec={b.spec} />);
          case "graph-error":
            return wrap(<GraphErrorBlock kind={b.kind} errors={b.errors} raw={b.raw} />);
          case "text":
            return wrap(<TextBlock content={b.content} />);
          default:
            return null;
        }
      })}
    </div>
  );
}
