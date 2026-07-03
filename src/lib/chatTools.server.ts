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
export const MAX_TOOL_ROUNDS = 5;

/**
 * OpenAI-shaped function schemas for the read-only WidgeTDC tools the chat may
 * invoke. Expanded from 2 → 12 tools to match CLI capability surface.
 * All tools are READ-ONLY — mutations route through HyperAgent plan/approve (AUR-4).
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
  // ── New tools (2 → 12 expansion) ──────────────────────────────────
  {
    type: "function",
    function: {
      name: "truth_distance",
      description:
        "Compute truth distance e(t) for a claim against platform graph truth. Use to verify if a statement is accurate before asserting it. Returns distance 0.0-1.0 (lower = more truthful) and semantic similarity.",
      parameters: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The claim or statement to validate" },
        },
        required: ["claim"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "claims_check",
      description:
        "Check a claim's maturity level (L1/L2/L3) and governance gate status. Use when discussing claim validity or promotion readiness.",
      parameters: {
        type: "object",
        properties: {
          claim_id: { type: "string", description: "The claim identifier to check" },
        },
        required: ["claim_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "canary_classify",
      description:
        "Classify evidence into the 5-tier canary framework (static/unit/integration/runtime/claim). Use when evaluating the quality of proof for a claim.",
      parameters: {
        type: "object",
        properties: {
          evidence_type: { type: "string", description: "Type of evidence to classify" },
          has_sample: { type: "boolean", description: "Whether a concrete sample exists" },
        },
        required: ["evidence_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resonance_validate",
      description:
        "Multi-provider resonance validation — checks if multiple agents agree on a claim. Returns resonance score r(t) 0.0-1.0 and consensus status.",
      parameters: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The claim to validate across providers" },
        },
        required: ["claim"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bom_status",
      description:
        "Check status of a BOM run — pending/running/completed/failed per BOMItem. Use when discussing project or plan execution state.",
      parameters: {
        type: "object",
        properties: {
          run_id: { type: "string", description: "BOM run identifier" },
        },
        required: ["run_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bom_lineage",
      description:
        "Trace the full lineage of a BOMItem — MethodSelected → ResolvedBy → GroundedBy → ExecutedWith → ProducedArtifact. Use for decision provenance.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "BOM item identifier" },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circuit_breaker_status",
      description:
        "Check circuit breaker status for platform services. Returns open/closed/half-open state and degradation signals. Use when diagnosing platform health.",
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Service name (optional, checks all if omitted)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "provider_matrix_show",
      description:
        "Show the current provider matrix configuration — primary, fallback, tier rates, success rates. Use when discussing LLM provider choice or routing.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "orchestrate_status",
      description:
        "Check status of multi-agent missions (rescue/release/incident/audit). Use when tracking platform operations.",
      parameters: {
        type: "object",
        properties: {
          mission_id: {
            type: "string",
            description: "Mission identifier (optional, lists all if omitted)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_completeness",
      description:
        "Check 5-layer mathematical completeness (graph, code, runtime, docs, impossibility) for a plan or solution. Use when evaluating if something is complete.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "Plan or solution identifier" },
        },
        required: ["plan_id"],
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
    // ── Original tools ──────────────────────────────────────────────
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

    // ── New tools (2 → 12 expansion) ────────────────────────────────
    if (call.name === "truth_distance") {
      const claim = String(args.claim ?? "").slice(0, 500);
      const result = await callMcpTool<unknown>(
        "truth.distance",
        { claim },
        { correlationId, timeoutMs: 10000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "claims_check") {
      const claimId = String(args.claim_id ?? "").slice(0, 100);
      const result = await callMcpTool<unknown>(
        "claims.check",
        { claim_id: claimId },
        { correlationId, timeoutMs: 10000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "canary_classify") {
      const result = await callMcpTool<unknown>(
        "canary.classify",
        { name: args.evidence_type ?? "", class: args.has_sample ? "runtime" : "static" },
        { correlationId, timeoutMs: 8000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "resonance_validate") {
      const claim = String(args.claim ?? "").slice(0, 500);
      const result = await callMcpTool<unknown>(
        "resonance.validate",
        { claim },
        { correlationId, timeoutMs: 15000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "bom_status") {
      const runId = String(args.run_id ?? "").slice(0, 100);
      const result = await callMcpTool<unknown>(
        "graph.read_cypher",
        {
          query: `MATCH (b:BOMRun {id: $runId}) RETURN b.status as status, b.created_at as created, b.items_processed as processed`,
          params: { runId },
        },
        { correlationId, timeoutMs: 10000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "bom_lineage") {
      const itemId = String(args.item_id ?? "").slice(0, 100);
      const result = await callMcpTool<unknown>(
        "graph.read_cypher",
        {
          query: `MATCH (i:BOMItem {id: $itemId})-[:RESOLVED_BY|GROUNDED_BY|EXECUTED_WITH|PRODUCED]->(t) RETURN type(t) as type, t.name as name`,
          params: { itemId },
        },
        { correlationId, timeoutMs: 10000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "circuit_breaker_status") {
      const service = args.service ? String(args.service).slice(0, 100) : undefined;
      const result = await callMcpTool<unknown>(
        "circuit_breaker.status",
        service ? { service } : {},
        { correlationId, timeoutMs: 8000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "provider_matrix_show") {
      const result = await callMcpTool<unknown>(
        "provider_matrix.show",
        {},
        { correlationId, timeoutMs: 5000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "orchestrate_status") {
      const missionId = args.mission_id ? String(args.mission_id).slice(0, 100) : undefined;
      const result = await callMcpTool<unknown>(
        "orchestrate.status",
        missionId ? { mission_id: missionId } : {},
        { correlationId, timeoutMs: 10000 },
      );
      return { toolCallId: call.id, name: call.name, content: compact(result) };
    }

    if (call.name === "verify_completeness") {
      const planId = String(args.plan_id ?? "").slice(0, 100);
      const result = await callMcpTool<unknown>(
        "verify.completeness",
        { plan_id: planId },
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
