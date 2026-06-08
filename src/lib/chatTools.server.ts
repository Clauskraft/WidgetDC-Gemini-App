/**
 * AUR-16: Agentic tool catalog for the chat handler.
 *
 * A small, READ-ONLY set of WidgeTDC platform tools the model may call mid-turn
 * to ground answers in live data — mirroring the curated action surface of the
 * ArchitectGPT private GPT (`apps/chatgpt/architectgpt/actions.openapi.yaml` in
 * the backend monorepo). Every tool routes through the governed `/api/mcp/route`
 * bridge via `callMcpTool`; there are NO write tools here — mutations must go
 * through the HyperAgent plan/approve flow (AUR-4), never the chat loop.
 *
 * The loop is OFF unless `CHAT_AGENTIC_TOOLS=1` so the verified streaming path
 * (AUR-15) ships independently of the (key-dependent, runtime-unverified) loop.
 */
import process from "node:process";
import { callMcpTool } from "./widgetdc.server";
import type { OpenAiToolSchema, OpenAiToolCall } from "./providers.server";

/** Feature flag — agentic tool loop is opt-in per deploy. */
export function agenticToolsEnabled(): boolean {
  return process.env.CHAT_AGENTIC_TOOLS === "1";
}

/** Max tool rounds before forcing a final answer (bounded loop, no runaway). */
export const MAX_TOOL_ROUNDS = 3;

/**
 * OpenAI-shaped function schemas for the read-only WidgeTDC tools the chat may
 * invoke. Kept deliberately small + high-signal.
 */
export const CHAT_TOOL_SCHEMAS: OpenAiToolSchema[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "Search the WidgeTDC knowledge graph + semantic vector store (NEXUS/SRAG + Neo4j) for platform data, consulting knowledge, patterns, documents or entities. Use to ground answers in real platform knowledge before asserting facts.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural-language search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "graph_read",
      description:
        "Run a whitelisted, read-only graph lookup against Neo4j. Use to fetch label overviews, sample subgraphs, or a node's neighbors when the user asks about graph structure or relationships.",
      parameters: {
        type: "object",
        properties: {
          named_query: {
            type: "string",
            enum: ["label-overview", "sample-subgraph", "neighbors"],
            description: "Which whitelisted query to run",
          },
          seed_label: {
            type: "string",
            description: "For 'neighbors': the seed node label (allow-listed server-side)",
          },
        },
        required: ["named_query"],
      },
    },
  },
];

/** Result of executing one tool call — fed back to the model as a tool message. */
export type ToolExecution = { toolCallId: string; name: string; content: string };

/** Whitelisted named graph queries (mirrors api/graph.query.ts governance). */
const NAMED_QUERIES: Record<string, string> = {
  "label-overview":
    "MATCH (n) RETURN labels(n) AS label, count(*) AS count ORDER BY count DESC LIMIT 25",
  "sample-subgraph":
    "MATCH (a)-[r]->(b) RETURN labels(a)[0] AS from, type(r) AS rel, labels(b)[0] AS to, count(*) AS count ORDER BY count DESC LIMIT 25",
};

function neighborsQuery(seedLabel: string): string | null {
  // Allow-list seed labels to keep raw client input out of Cypher (governance).
  const allowed = new Set([
    "Agent",
    "MCPTool",
    "KnowledgePattern",
    "StrategicInsight",
    "Decision",
    "Claim",
    "Evidence",
  ]);
  if (!allowed.has(seedLabel)) return null;
  return `MATCH (a:${seedLabel})-[r]-(b) RETURN a.name AS seed, type(r) AS rel, labels(b)[0] AS neighbor LIMIT 30`;
}

/**
 * Execute a single tool call against the governed MCP bridge. All failures are
 * swallowed into a short error string so the loop can continue and the model
 * can recover — a tool error must never crash the chat turn.
 */
export async function executeToolCall(
  call: OpenAiToolCall,
  correlationId?: string,
): Promise<ToolExecution> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    args = {};
  }

  try {
    if (call.name === "search_knowledge") {
      const query = String(args.query ?? "").slice(0, 500);
      const result = await callMcpTool<unknown>(
        "search_knowledge",
        { query },
        { correlationId, timeoutMs: 12000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "graph_read") {
      const named = String(args.named_query ?? "");
      let cypher: string | null = NAMED_QUERIES[named] ?? null;
      if (named === "neighbors") cypher = neighborsQuery(String(args.seed_label ?? ""));
      if (!cypher) {
        return {
          toolCallId: call.id,
          name: call.name,
          content: "ERROR: unknown or non-whitelisted query/seed_label",
        };
      }
      const result = await callMcpTool<unknown>(
        "data_graph_read",
        { query: cypher },
        { correlationId, timeoutMs: 15000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    return { toolCallId: call.id, name: call.name, content: `ERROR: unknown tool ${call.name}` };
  } catch (err) {
    return {
      toolCallId: call.id,
      name: call.name,
      content: `ERROR: ${err instanceof Error ? err.message : "tool failed"}`,
    };
  }
}

/** Stringify a tool result compactly, capped so it never blows the context. */
function compact(result: unknown): string {
  if (result == null) return "No result (platform unavailable or empty).";
  if (typeof result === "string") return result.slice(0, 4000);
  try {
    return JSON.stringify(result).slice(0, 4000);
  } catch {
    return "Unserializable result.";
  }
}
