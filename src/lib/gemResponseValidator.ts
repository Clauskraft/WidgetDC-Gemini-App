/**
 * gemResponseValidator — runtime validator for assistant messages produced
 * by Gem-bots, ensuring de matcher platformens forventede canvas/note
 * struktur FØR de sendes videre (persistens, canvas-panel, MCP-bridge).
 *
 * Designprincipper:
 *  - Pure & synchronous. Ingen network, ingen React, ingen side-effects.
 *  - Total: kaster aldrig. Returnerer altid {ok, issues, artifacts}.
 *  - Per-gem regelset (issue-trees, threat-models, OPC-UA tabeller,
 *    OSINT pivot-grafer) afledt af gemmenes system-prompts.
 *  - Issues har `severity: "error" | "warn"` — `ok` er kun true når
 *    der ikke er nogen errors.
 */

import { z } from "zod";

// ── Re-deklaration af CFDS node-kinds (holdes synkroniseret med FlowFigure).
// Vi imp orterer ikke fra FlowFigure for at undgå React/CSS-side-effects
// i en pure validator-modul.
const CANONICAL_NODE_KINDS = [
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
type CanonicalKind = (typeof CANONICAL_NODE_KINDS)[number];

const LEGACY_KIND_MAP: Record<string, CanonicalKind> = {
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

function normalizeKind(raw: unknown): CanonicalKind | null {
  if (typeof raw !== "string") return null;
  if ((CANONICAL_NODE_KINDS as readonly string[]).includes(raw)) {
    return raw as CanonicalKind;
  }
  return LEGACY_KIND_MAP[raw.toLowerCase()] ?? null;
}

const FlowNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.unknown().optional(),
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    lane: z.string().optional(),
    modes: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    regulatoryLevel: z.enum(["strict", "guideline", "info"]).optional(),
    complianceScore: z.number().min(0).max(1).optional(),
  })
  .passthrough();

const FlowEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

const FlowSpecSchema = z
  .object({
    title: z.string().optional(),
    direction: z.enum(["LR", "TD"]).optional(),
    nodes: z.array(FlowNodeSchema).min(1),
    edges: z.array(FlowEdgeSchema).default([]),
  })
  .passthrough();

export type FlowExtract = {
  spec: z.infer<typeof FlowSpecSchema>;
  kinds: CanonicalKind[]; // normaliserede kinds (dedup'ed)
};

export type TableExtract = {
  headers: string[];
  rowCount: number;
};

export type CodeBlock = { lang: string; body: string };

export type ValidationIssue = {
  code: string;
  severity: "error" | "warn";
  message: string;
  detail?: Record<string, unknown>;
};

export type ValidationArtifacts = {
  flowBlocks: FlowExtract[];
  mermaidBlocks: { kind: string | null; raw: string }[];
  tables: TableExtract[];
  canvasNotes: string[];
  codeBlocks: CodeBlock[];
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
  artifacts: ValidationArtifacts;
};

/* ────────────────────────────────────────────────────────────────────────── *
 * Extractors                                                                 *
 * ────────────────────────────────────────────────────────────────────────── */

const FENCE_RE = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;

function extractCodeBlocks(text: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  for (const m of text.matchAll(FENCE_RE)) {
    out.push({ lang: (m[1] || "").toLowerCase(), body: m[2] });
  }
  return out;
}

function extractFlowBlocks(blocks: CodeBlock[]): {
  flows: FlowExtract[];
  issues: ValidationIssue[];
} {
  const flows: FlowExtract[] = [];
  const issues: ValidationIssue[] = [];
  for (const b of blocks) {
    if (b.lang !== "flow") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(b.body);
    } catch (err) {
      issues.push({
        code: "flow_invalid_json",
        severity: "error",
        message: "flow-blok indeholder ikke gyldig JSON.",
        detail: { error: String(err) },
      });
      continue;
    }
    const result = FlowSpecSchema.safeParse(parsed);
    if (!result.success) {
      issues.push({
        code: "flow_invalid_schema",
        severity: "error",
        message: "flow-blok matcher ikke FlowSpec-skemaet.",
        detail: { issues: result.error.issues.slice(0, 5) },
      });
      continue;
    }
    const kinds = new Set<CanonicalKind>();
    let unknownKinds = 0;
    for (const n of result.data.nodes) {
      const k = normalizeKind(n.kind);
      if (k) kinds.add(k);
      else if (n.kind !== undefined) unknownKinds++;
    }
    if (unknownKinds > 0) {
      issues.push({
        code: "flow_unknown_kind",
        severity: "warn",
        message: `flow-blok bruger ${unknownKinds} ukendt(e) node-kind(s) — falder tilbage til Artifact ved render.`,
      });
    }
    // Edge-konnektivitet: alle from/to skal pege på en eksisterende node.
    const nodeIds = new Set(result.data.nodes.map((n) => n.id));
    const dangling = result.data.edges.filter((e) => !nodeIds.has(e.from) || !nodeIds.has(e.to));
    if (dangling.length > 0) {
      issues.push({
        code: "flow_dangling_edge",
        severity: "error",
        message: `flow-blok har ${dangling.length} edge(s) der peger på ukendte node-ID'er.`,
        detail: { samples: dangling.slice(0, 3) },
      });
    }
    flows.push({ spec: result.data, kinds: [...kinds] });
  }
  return { flows, issues };
}

function extractMermaidBlocks(blocks: CodeBlock[]) {
  return blocks
    .filter((b) => b.lang === "mermaid")
    .map((b) => {
      const firstWord = b.body.trim().split(/\s+/)[0] ?? "";
      return { kind: firstWord || null, raw: b.body };
    });
}

/** Find markdown-tabeller (rudimentary GFM-style). */
function extractTables(text: string): TableExtract[] {
  const out: TableExtract[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const head = lines[i];
    const sep = lines[i + 1];
    if (!/^\s*\|.+\|\s*$/.test(head)) continue;
    if (!/^\s*\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|\s*$/.test(sep)) continue;
    const headers = head
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((s) => s.trim());
    let rowCount = 0;
    for (let j = i + 2; j < lines.length; j++) {
      if (!/^\s*\|.+\|\s*$/.test(lines[j])) break;
      rowCount++;
    }
    out.push({ headers, rowCount });
    i += 1 + rowCount;
  }
  return out;
}

/** Find "Canvas notes:" sektion og parse bullets. */
function extractCanvasNotes(text: string): string[] {
  const re = /(?:^|\n)\s*(?:#+\s*)?canvas notes\s*:?\s*\n([\s\S]*?)(?:\n\s*\n|$)/i;
  const m = text.match(re);
  if (!m) return [];
  const bullets: string[] = [];
  for (const line of m[1].split("\n")) {
    const b = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/);
    if (b) bullets.push(b[1]);
  }
  return bullets;
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Per-gem rules                                                              *
 * ────────────────────────────────────────────────────────────────────────── */

const ATTACK_ID_RE = /\bT\d{4}(?:\.\d{3})?\b/;
const ADMIRALTY_RE = /\b[A-F][1-6]\b/;
const SIGMA_HINT_RE = /^\s*title\s*:|^\s*detection\s*:/m;
const KQL_HINT_RE = /\b(SecurityEvent|SigninLogs|DeviceLogonEvents|union\s+\w+|where\s+\w+)\b/;
const SPL_HINT_RE = /\b(index\s*=|sourcetype\s*=|\bstats\s+count\b)/;
const NIS2_RE = /\bNIS\s?2|art(\.|icle)\s*21|art(\.|icle)\s*23\b/i;
const OPCUA_HEADER_RE = /node\s*id|opc[-\s]?ua|sample[-\s]?rate|semantic\s*id/i;
const OEE_RE = /\bOEE\b|\b(availability|performance|quality)\s*[×x*]\b/i;
const BLUF_RE = /\bBLUF\b|bottom line up front/i;
const KEY_JUDG_RE = /key judgments?/i;

// McKinsey Pyramid Principle detection
// Governing thought = bold/italic first sentence OR heading at top of response
const GOVERNING_THOUGHT_RE =
  /^(?:\s*#{1,3}\s+.{10,}|\*\*[^*]{10,}\*\*|__[^_]{10,}__)\s*\n/m;
// Three-pillar structure: 3+ distinct H2/H3 sections OR numbered sections
const THREE_PILLAR_RE =
  /(?:^#{2,3}\s+.+$\s*){3,}|(?:^\d+\.\s+\*{0,2}.{5,}\*{0,2}$\s*){3,}/m;

type Rule = (a: ValidationArtifacts, text: string) => ValidationIssue[];

const COMMON_RULES: Rule[] = [
  (a) => {
    if (a.canvasNotes.length === 0) {
      return [
        {
          code: "missing_canvas_notes",
          severity: "error",
          message:
            "Svaret mangler en 'Canvas notes:' sektion — Canvas-panelet kan ikke pin'e nøgleindsigter.",
        },
      ];
    }
    if (a.canvasNotes.length < 3) {
      return [
        {
          code: "thin_canvas_notes",
          severity: "warn",
          message: `Canvas notes har kun ${a.canvasNotes.length} bullet(s); forventer 3-5.`,
        },
      ];
    }
    return [];
  },
];

const GEM_RULES: Record<string, Rule[]> = {
  "consulting-strategist": [
    (a) => {
      if (a.flowBlocks.length === 0 && a.mermaidBlocks.length === 0) {
        return [
          {
            code: "missing_visualization",
            severity: "warn",
            message:
              "Consulting-svar bør indeholde mindst én flow- eller mermaid-blok (issue-tree, 2x2, roadmap).",
          },
        ];
      }
      return [];
    },
    (a) => {
      const REASONING_KINDS = new Set<CanonicalKind>([
        "Claim",
        "Decision",
        "Insight",
        "StrategicInsight",
        "StrategicLeverage",
        "KnowledgePattern",
      ]);
      const hasReasoning = a.flowBlocks.some((f) => f.kinds.some((k) => REASONING_KINDS.has(k)));
      if (a.flowBlocks.length > 0 && !hasReasoning) {
        return [
          {
            code: "consulting_flow_lacks_reasoning_kinds",
            severity: "warn",
            message:
              "Issue-tree forventes at bruge mindst én reasoning/foundry-kind (Claim, Decision, Insight, StrategicInsight, StrategicLeverage, KnowledgePattern).",
          },
        ];
      }
      return [];
    },
    (_, text) => {
      const hasFramework =
        /\b(SCQA|MECE|Pyramid|2x2|RACI|OKR|Wardley|Three Horizons|5\s*Forces|Ansoff)\b/i.test(text);
      if (!hasFramework) {
        return [
          {
            code: "consulting_no_framework_signal",
            severity: "warn",
            message:
              "Svaret henviser ikke til et anerkendt strategi-framework (SCQA, MECE, Pyramid, 2x2, RACI, OKR, Wardley, 5 Forces, Ansoff).",
          },
        ];
      }
      return [];
    },
  ],

  "cyber-defender": [
    (a, text) => {
      const hasThreatModelFlow = a.flowBlocks.some(
        (f) =>
          f.kinds.includes("Agent") &&
          f.kinds.some((k) => k === "ComplianceGap" || k === "GuardrailRule"),
      );
      const hasDetection =
        a.codeBlocks.some(
          (b) => ["yaml", "yml", "sigma"].includes(b.lang) && SIGMA_HINT_RE.test(b.body),
        ) ||
        a.codeBlocks.some(
          (b) => b.lang === "kql" || b.lang === "kusto" || KQL_HINT_RE.test(b.body),
        ) ||
        a.codeBlocks.some((b) => b.lang === "spl" || SPL_HINT_RE.test(b.body));

      if (!hasThreatModelFlow && !hasDetection) {
        return [
          {
            code: "cyber_missing_artifact",
            severity: "error",
            message:
              "Cyber-svar skal levere enten en threat-model flow-blok (Agent + ComplianceGap/GuardrailRule) ELLER en konkret detektion (Sigma/KQL/SPL).",
          },
        ];
      }
      // Bonus: ATT&CK reference når trusler nævnes
      if (/\b(threat|attack|adversary|kill chain|TTP)\b/i.test(text) && !ATTACK_ID_RE.test(text)) {
        return [
          {
            code: "cyber_missing_attack_id",
            severity: "warn",
            message: "Svaret nævner trusler/TTPs men mangler MITRE ATT&CK-ID (fx T1078.004).",
          },
        ];
      }
      return [];
    },
    (_a, text) => {
      if (
        /\b(NIS2|DORA|ISO 27001|NIST CSF|GDPR)\b/i.test(text) &&
        !NIS2_RE.test(text) &&
        !/\bArt(\.|icle)\s*\d+/i.test(text) &&
        !/\b(ID|PR|DE|RS|RC|GV)\.[A-Z]{2}-\d+/.test(text)
      ) {
        return [
          {
            code: "cyber_compliance_without_control_id",
            severity: "warn",
            message: "Compliance-frameworks nævnes uden konkrete artikel-/kontrol-ID'er.",
          },
        ];
      }
      return [];
    },
  ],

  "lego-factory-architect": [
    (a) => {
      const hasOpcuaTable = a.tables.some((t) => t.headers.some((h) => OPCUA_HEADER_RE.test(h)));
      const hasFlow = a.flowBlocks.length > 0 || a.mermaidBlocks.length > 0;
      if (!hasOpcuaTable && !hasFlow) {
        return [
          {
            code: "factory_missing_artifact",
            severity: "error",
            message:
              "Factory-svar skal indeholde enten en OPC-UA datakontrakt-tabel (NodeID/sample-rate/semantic ID) ELLER en flow/mermaid layout-visualisering.",
          },
        ];
      }
      return [];
    },
    (a, text) => {
      const hasUnits = /\b\d+(?:[.,]\d+)?\s*(Hz|ms|s|kW|bar|mm|m|°C|kg|min|%)\b/.test(text);
      const looksLikePerformance =
        OEE_RE.test(text) || /\btakt\b|cycle time|line balanc/i.test(text);
      if (looksLikePerformance && !hasUnits) {
        return [
          {
            code: "factory_missing_units",
            severity: "warn",
            message: "Performance-snak (OEE/takt/cycle) uden SI-enheder (Hz, s, %, mm, kW).",
          },
        ];
      }
      if (
        a.tables.some((t) => t.headers.some((h) => /node\s*id/i.test(h))) &&
        a.tables.every((t) => t.rowCount === 0)
      ) {
        return [
          {
            code: "factory_empty_opcua_table",
            severity: "error",
            message: "OPC-UA tabel har header men ingen rækker.",
          },
        ];
      }
      return [];
    },
  ],

  "default": [
    (_, text) => {
      // McKinsey Pyramid: answer must lead with a governing thought (bold/heading)
      if (text.length < 200) return []; // skip trivial responses
      const hasGoverningThought = GOVERNING_THOUGHT_RE.test(text);
      if (!hasGoverningThought) {
        return [
          {
            code: "missing_governing_thought",
            severity: "warn",
            message:
              "Svaret mangler en 'governing thought' — McKinsey Pyramid Principle kræver at konklusionen kommer FØRST (bold åbningssætning eller H1/H2 overskrift).",
          },
        ];
      }
      return [];
    },
    (_, text) => {
      // McKinsey three-pillar: substantive responses need ≥3 distinct sections
      if (text.length < 400) return []; // only for longer responses
      const hasThreePillars = THREE_PILLAR_RE.test(text);
      if (!hasThreePillars) {
        return [
          {
            code: "missing_three_pillar_structure",
            severity: "warn",
            message:
              "Svaret mangler 3-søjle-struktur — McKinsey-svar bør have mindst 3 tydelige sektioner (## overskrifter eller nummererede punkter).",
          },
        ];
      }
      return [];
    },
    (_, text) => {
      // Evidence grounding: longer responses should cite at least one source
      if (text.length < 500) return [];
      const hasCitation = /\[\d+\]|\[source\]|\bkilde\b|\bsource\b|\bper\s+\w+\b/i.test(text);
      if (!hasCitation) {
        return [
          {
            code: "missing_evidence_citation",
            severity: "warn",
            message:
              "Svaret mangler kildehenvisning — McKinsey-standard kræver at alle claims er forankret i data/kilder ([n] eller inline kilde-reference).",
          },
        ];
      }
      return [];
    },
  ],

  "osint-analyst": [
    (a, text) => {
      const hasPivotGraph = a.flowBlocks.some(
        (f) =>
          f.kinds.includes("Entity") || f.kinds.includes("query") || f.kinds.includes("Evidence"),
      );
      const hasExplicitPivotList = /pivot[- ]?(plan|tree|chain)|collection plan/i.test(text);
      if (!hasPivotGraph && !hasExplicitPivotList) {
        return [
          {
            code: "osint_missing_pivot_structure",
            severity: "error",
            message:
              "OSINT-svar skal enten levere en pivot-graf (flow med Entity/query/Evidence) ELLER en eksplicit collection/pivot-plan.",
          },
        ];
      }
      return [];
    },
    (_a, text) => {
      const looksLikeReport =
        BLUF_RE.test(text) || KEY_JUDG_RE.test(text) || /confidence|konfidens/i.test(text);
      if (looksLikeReport && !ADMIRALTY_RE.test(text)) {
        return [
          {
            code: "osint_missing_admiralty",
            severity: "warn",
            message: "Rapporten mangler Admiralty-scoring (A-F × 1-6) på kilder.",
          },
        ];
      }
      return [];
    },
    (_a, text) => {
      // Hård regel: fabrikerede konkrete URLs/IP'er ikke tilladt som "fundne data".
      // Tillader [src#N] citationer og generiske eksempler (example.com, example[.]tld).
      const realisticUrl = /\bhttps?:\/\/(?!example\.|example-)[a-z0-9.-]+\.[a-z]{2,}/i;
      const realisticIp = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;
      if (
        (realisticUrl.test(text) || realisticIp.test(text)) &&
        !/hypotet|eksempel|placeholder|requires? live|kræver live/i.test(text)
      ) {
        return [
          {
            code: "osint_unverified_selector",
            severity: "warn",
            message:
              "Konkrete URLs/IP'er optræder uden 'hypotetisk' / 'kræver live query'-markering — risiko for fabrikeret data.",
          },
        ];
      }
      return [];
    },
  ],
};

/* ────────────────────────────────────────────────────────────────────────── *
 * Public API                                                                 *
 * ────────────────────────────────────────────────────────────────────────── */

/** Pure ekstraktion uden gem-specifik validering — handy til UI/debug. */
export function extractArtifacts(text: string): ValidationArtifacts {
  const codeBlocks = extractCodeBlocks(text);
  const { flows } = extractFlowBlocks(codeBlocks);
  return {
    flowBlocks: flows,
    mermaidBlocks: extractMermaidBlocks(codeBlocks),
    tables: extractTables(text),
    canvasNotes: extractCanvasNotes(text),
    codeBlocks,
  };
}

/**
 * Validér et gem-svar mod platformens forventede canvas/note struktur.
 *
 * @param text   Hele den færdige assistant-message tekst (efter stream-finish).
 * @param gemId  Gem-id (consulting-strategist | cyber-defender |
 *               lego-factory-architect | osint-analyst). Ukendt id giver
 *               kun de fælles canvas-notes-tjek.
 */
export function validateGemResponse(text: string, gemId: string): ValidationResult {
  const codeBlocks = extractCodeBlocks(text);
  const { flows, issues: flowIssues } = extractFlowBlocks(codeBlocks);
  const artifacts: ValidationArtifacts = {
    flowBlocks: flows,
    mermaidBlocks: extractMermaidBlocks(codeBlocks),
    tables: extractTables(text),
    canvasNotes: extractCanvasNotes(text),
    codeBlocks,
  };

  const ruleIssues: ValidationIssue[] = [];
  for (const rule of COMMON_RULES) ruleIssues.push(...rule(artifacts, text));
  // Fall back to "default" McKinsey-storyline rules when no specific gem matches
  const gemRules = GEM_RULES[gemId] ?? GEM_RULES["default"] ?? [];
  for (const rule of gemRules) ruleIssues.push(...rule(artifacts, text));

  const issues = [...flowIssues, ...ruleIssues];
  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues, artifacts };
}
