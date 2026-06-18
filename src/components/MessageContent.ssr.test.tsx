import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MessageContent } from "./MessageContent";
import { parseBlocks } from "@/lib/figureBlocks";

const CHART_BLOCK = [
  "```chart",
  JSON.stringify({
    kind: "bar",
    data: [
      { label: "Q1", value: 10 },
      { label: "Q2", value: 20 },
    ],
    series: [{ key: "value", label: "Omsætning" }],
    xKey: "label",
    caption: "Test",
  }),
  "```",
].join("\n");

const FLOW_BLOCK = [
  "```flow",
  JSON.stringify({
    title: "RAG",
    direction: "LR",
    nodes: [
      { id: "u", kind: "agent", label: "User" },
      { id: "q", kind: "tool", label: "Query" },
    ],
    edges: [{ from: "u", to: "q" }],
  }),
  "```",
].join("\n");

const GRAPH_BLOCK = [
  "```graph",
  JSON.stringify({
    caption: "Agent pipeline",
    nodes: [
      { id: "a", label: "Agent", type: "agent" },
      { id: "t", label: "Tool", type: "tool" },
    ],
    edges: [{ source: "a", target: "t", label: "calls" }],
  }),
  "```",
].join("\n");

const KNOWLEDGE_GRAPH_BLOCK = [
  "```knowledge-graph",
  JSON.stringify({
    caption: "GraphRAG",
    nodes: [
      { id: "neo4j", label: "Neo4j", type: "database" },
      { id: "entity", label: "Entity", type: "concept" },
    ],
    edges: [{ from: "neo4j", to: "entity", label: "stores" }],
  }),
  "```",
].join("\n");

const SVG_BLOCK = [
  "```svg",
  '<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>',
  "```",
].join("\n");
const FIGURE_BLOCK = ["```figure", "**Caption** med markdown", "```"].join("\n");

const MARKDOWN = ["# Overskrift", "", "Almindelig prosa med **fed** tekst."].join("\n");

const ALL_BLOCKS = [
  MARKDOWN,
  CHART_BLOCK,
  FLOW_BLOCK,
  GRAPH_BLOCK,
  KNOWLEDGE_GRAPH_BLOCK,
  SVG_BLOCK,
  FIGURE_BLOCK,
].join("\n\n");

describe("MessageContent SSR", () => {
  it("parser splitter input i forventede block-typer", () => {
    const blocks = parseBlocks(ALL_BLOCKS);
    const types = blocks.map((b) => b.type);
    expect(types).toContain("text");
    expect(types).toContain("chart");
    expect(types).toContain("flow");
    expect(types).toContain("graph");
    expect(types).toContain("knowledge-graph");
    expect(types).toContain("svg");
    expect(types).toContain("figure");
  });

  it.each([
    ["markdown", MARKDOWN],
    ["chart", CHART_BLOCK],
    ["flow", FLOW_BLOCK],
    ["graph", GRAPH_BLOCK],
    ["knowledge-graph", KNOWLEDGE_GRAPH_BLOCK],
    ["svg", SVG_BLOCK],
    ["figure", FIGURE_BLOCK],
    ["kombineret", ALL_BLOCKS],
  ])("renderer %s uden at kaste under SSR", (_name, text) => {
    let html = "";
    expect(() => {
      html = renderToString(<MessageContent text={text} />);
    }).not.toThrow();
    expect(html.length).toBeGreaterThan(0);
  });

  it("ugyldig chart-JSON degraderer til kode-blok i stedet for at crashe", () => {
    const broken = "```chart\n{ not json\n```";
    let html = "";
    expect(() => {
      html = renderToString(<MessageContent text={broken} />);
    }).not.toThrow();
    expect(html).toContain("not json");
  });

  it("ugyldig flow-JSON viser fejlmeddelelse i stedet for at crashe", () => {
    const broken = "```flow\n{ not json\n```";
    let html = "";
    expect(() => {
      html = renderToString(<MessageContent text={broken} />);
    }).not.toThrow();
    expect(html).toContain("Ugyldig flow-blok");
  });
});
