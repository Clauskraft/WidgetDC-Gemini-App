/**
 * Visualization intent → family resolver (CFDS §2-§3).
 *
 * Bringer "intent → standard"-laget fra WidgeTDC `VisualizationStandards.ts`
 * ind i Aurora: en fri-form-brief eller en mermaid-body kategoriseres til
 * præcis ÉN canonical family. Det giver os to ting:
 *   1) En lille "family-chip" på artifacts så brugeren ser hvilket sprog
 *      diagrammet taler (bpmn/c4/erd/sequence/…).
 *   2) En valideringsmulighed: hvis LLM'en producerede `graph TD` til en
 *      `data-model` brief, kan vi advare (eller senere auto-rewrite).
 *
 * Algoritmen er en let port af `detectIntent` (KEYWORD_SIGNALS, +2 per hit,
 * +1 for node-type binding, default = system-architecture/c4).
 */

export type VisualizationFamily =
  | "bpmn"
  | "c4"
  | "archimate"
  | "sequence"
  | "erd"
  | "dfd"
  | "state"
  | "capability-map"
  | "value-stream"
  | "decision-tree";

export type VisualizationIntent =
  | "business-process"
  | "system-architecture"
  | "enterprise-architecture"
  | "interaction-flow"
  | "data-model"
  | "data-flow"
  | "state-lifecycle"
  | "capability-map"
  | "value-stream"
  | "decision-logic";

export interface VisualizationStandard {
  intent: VisualizationIntent;
  family: VisualizationFamily;
  mermaidType: string;
  drawioType: string;
  label: string;
}

export const VISUALIZATION_STANDARDS: Record<VisualizationIntent, VisualizationStandard> = {
  "business-process":        { intent: "business-process",        family: "bpmn",            mermaidType: "flowchart", drawioType: "flowchart",    label: "BPMN" },
  "system-architecture":     { intent: "system-architecture",     family: "c4",              mermaidType: "c4",        drawioType: "c4",           label: "C4" },
  "enterprise-architecture": { intent: "enterprise-architecture", family: "archimate",       mermaidType: "flowchart", drawioType: "architecture", label: "ArchiMate" },
  "interaction-flow":        { intent: "interaction-flow",        family: "sequence",        mermaidType: "sequence",  drawioType: "sequence",     label: "Sequence" },
  "data-model":              { intent: "data-model",              family: "erd",             mermaidType: "er",        drawioType: "er",           label: "ERD" },
  "data-flow":               { intent: "data-flow",               family: "dfd",             mermaidType: "flowchart", drawioType: "data-flow",    label: "DFD" },
  "state-lifecycle":         { intent: "state-lifecycle",         family: "state",           mermaidType: "state",     drawioType: "flowchart",    label: "State" },
  "capability-map":          { intent: "capability-map",          family: "capability-map",  mermaidType: "mindmap",   drawioType: "mindmap",      label: "Capability" },
  "value-stream":            { intent: "value-stream",            family: "value-stream",    mermaidType: "journey",   drawioType: "timeline",     label: "Value Stream" },
  "decision-logic":          { intent: "decision-logic",          family: "decision-tree",   mermaidType: "flowchart", drawioType: "flowchart",    label: "Decision Tree" },
};

/**
 * Vægtede signaler — +2 per hit (jf. VisualizationStandards.ts:608).
 * VIGTIGT: matches via word-boundary (\b<kw>\b), så `er` ikke matcher i `user`/`server`,
 * og syntaks-tokens som `state`/`class`/`er` ikke triggerer på mermaid-headeren selv.
 */
const KEYWORD_SIGNALS: Record<VisualizationIntent, string[]> = {
  "business-process":        ["proces", "process", "approval", "godkend", "godkendelse", "workflow", "bpmn", "handover"],
  "system-architecture":     ["arkitektur", "architecture", "microservice", "microservices", "c4 model", "container diagram", "component diagram"],
  "enterprise-architecture": ["enterprise architecture", "domæne", "capability", "archimate", "portefølje", "portfolio"],
  "interaction-flow":        ["sekvens", "sequence", "interaktion", "interaction", "round-trip", "agent-til-agent", "multi-agent", "routing"],
  "data-model":              ["entitet", "entity", "relation", "schema", "tabel", "erd", "data model", "datamodel", "er-diagram", "er diagram"],
  "data-flow":               ["dataflow", "data flow", "pipeline", "etl", "ingest", "dfd"],
  "state-lifecycle":         ["tilstand", "lifecycle", "livscyklus", "transition", "fsm", "state machine", "statemachine"],
  "capability-map":          ["mindmap", "mind map", "capability map", "kompetence"],
  "value-stream":            ["value stream", "værdistrøm", "journey", "kunderejse", "rejse", "timeline", "tidslinje"],
  "decision-logic":          ["beslutning", "decision", "if-then", "decision tree", "beslutningstræ"],
};


/** Node-type → preferred intent (subset af NODE_BINDINGS §3). +1 boost. */
const NODE_TYPE_BIAS: Record<string, VisualizationIntent> = {
  Agent: "interaction-flow",
  Decision: "decision-logic",
  ComplianceGap: "decision-logic",
  Track: "business-process",
  Entity: "data-model",
  Evidence: "data-flow",
  Artifact: "value-stream",
  StrategicLeverage: "capability-map",
  KnowledgePattern: "capability-map",
  GuardrailRule: "decision-logic",
  Memory: "data-model",
  Claim: "interaction-flow",
};

export interface IntentSignal {
  kind: "keyword" | "node-type";
  /** Råteksten der trigger (keyword eller node-type-navn). */
  token: string;
  /** Score-bidrag (+2 for keyword, +1 for node-type-bias). */
  weight: number;
}

export interface IntentDetectionResult {
  intent: VisualizationIntent;
  standard: VisualizationStandard;
  score: number;
  confidence: "high" | "medium" | "low";
  scores: Record<VisualizationIntent, number>;
  /** Hvilke signaler bidrog til den valgte intent (forklarer hvorfor). */
  matchedSignals: IntentSignal[];
  /** Alle signaler pr. intent — bruges fx i tooltip til at vise runner-ups. */
  signalsByIntent: Record<VisualizationIntent, IntentSignal[]>;
  /** Menneskelig forklaring på confidence-justering. */
  reason: string;
}

/**
 * Fjern mermaid-syntaks (headere, init-block, classDef/style, arrows, bracket-types)
 * så keyword-match kun ser reel label-tekst, ikke syntaks-tokens som `state`/`er`/`class`.
 */
function stripMermaidSyntax(s: string): string {
  return s
    .replace(/%%\{[\s\S]*?\}%%/g, " ")                       // init-block
    .replace(/^\s*(flowchart|graph|sequencediagram|erdiagram|statediagram(-v2)?|classdiagram|journey|mindmap|gantt|c4(context|container|component|dynamic|deployment)?)\b.*$/gim, " ")
    .replace(/^\s*(classdef|style|linkstyle|class)\s+.*$/gim, " ")
    .replace(/[-=.]{1,2}>{1,2}|<[-=.]{1,2}|\|\|--o\{|\}o--\|\||--/g, " ") // arrows / er-relations
    .replace(/[\[\](){}|]/g, " ")                            // node-brackets
    .replace(/\s+/g, " ");
}

/** Match keyword med word-boundary; multi-word kw matches som phrase. */
function matchKeyword(text: string, kw: string): boolean {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b virker dårligt med non-ASCII (æ/ø/å); brug lookaround mod ord-tegn.
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "u");
  return re.test(text);
}

/** Detect intent fra fri brief + valgfri liste af node-typer. */
export function detectIntent(brief: string, nodeTypes: string[] = []): IntentDetectionResult {

  const text = stripMermaidSyntax((brief ?? "").toLowerCase());
  const scores = Object.fromEntries(
    (Object.keys(VISUALIZATION_STANDARDS) as VisualizationIntent[]).map((k) => [k, 0]),
  ) as Record<VisualizationIntent, number>;
  const signalsByIntent = Object.fromEntries(
    (Object.keys(VISUALIZATION_STANDARDS) as VisualizationIntent[]).map((k) => [k, [] as IntentSignal[]]),
  ) as Record<VisualizationIntent, IntentSignal[]>;

  for (const [intent, keywords] of Object.entries(KEYWORD_SIGNALS) as [VisualizationIntent, string[]][]) {
    for (const kw of keywords) {
      if (matchKeyword(text, kw)) {
        scores[intent] += 2;
        signalsByIntent[intent].push({ kind: "keyword", token: kw, weight: 2 });
      }
    }
  }

  for (const t of nodeTypes) {
    const biased = NODE_TYPE_BIAS[t];
    if (biased) {
      scores[biased] += 1;
      signalsByIntent[biased].push({ kind: "node-type", token: t, weight: 1 });
    }
  }

  // Pick winner; default = system-architecture (jf. spec).
  let best: VisualizationIntent = "system-architecture";
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores) as [VisualizationIntent, number][]) {
    if (v > bestScore) {
      best = k;
      bestScore = v;
    }
  }
  const confidence: "high" | "medium" | "low" =
    bestScore >= 4 ? "high" : bestScore >= 2 ? "medium" : "low";

  const matchedSignals = signalsByIntent[best];
  const reason =
    bestScore === 0
      ? "Ingen signaler matchede — default 'system-architecture' (lav confidence)."
      : confidence === "high"
        ? `Høj confidence: score ${bestScore} (≥4) baseret på ${matchedSignals.length} signal(er).`
        : confidence === "medium"
          ? `Medium confidence: score ${bestScore} (2-3). Nedjusteret — for få stærke signaler til at flagge mismatch.`
          : `Lav confidence: score ${bestScore} (<2). Nedjusteret — for tvetydigt til at flagge mismatch.`;

  return {
    intent: best,
    standard: VISUALIZATION_STANDARDS[best],
    score: bestScore,
    confidence,
    scores,
    matchedSignals,
    signalsByIntent,
    reason,
  };
}

/** Læs mermaid-headertype fra body (første ord-token), fx "graph", "sequenceDiagram", "erDiagram". */
export function detectMermaidType(body: string): string | null {
  const m = body.trim().match(/^([a-zA-Z0-9]+)/);
  if (!m) return null;
  const head = m[1].toLowerCase();
  if (head.startsWith("sequence")) return "sequence";
  if (head.startsWith("er")) return "er";
  if (head.startsWith("state")) return "state";
  if (head.startsWith("classd") || head === "class") return "class";
  if (head.startsWith("journey")) return "journey";
  if (head.startsWith("mindmap")) return "mindmap";
  if (head.startsWith("flowchart") || head === "graph") return "flowchart";
  if (head.startsWith("c4")) return "c4";
  if (head.startsWith("gantt")) return "gantt";
  return head;
}

/** Sammenlign detekteret intent med faktisk mermaid-type → kontrakt-mismatch? */
export function isMermaidMismatch(intent: VisualizationIntent, actualMermaidType: string | null): boolean {
  if (!actualMermaidType) return false;
  const expected = VISUALIZATION_STANDARDS[intent].mermaidType.toLowerCase();
  // flowchart accepterer både "flowchart" og "graph" → er allerede normaliseret.
  if (expected === actualMermaidType.toLowerCase()) return false;
  // Lav-confidence detekteringer flagger vi ikke som mismatch — kun klare mismatch.
  return true;
}
