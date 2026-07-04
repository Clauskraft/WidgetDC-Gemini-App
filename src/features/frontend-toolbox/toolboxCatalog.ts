export type ToolboxSource = "openwiki" | "page-agent" | "wdc" | "lovable";
export type ProofBoundary = "candidate" | "diagnostic" | "runtime" | "claim";
export type ToolboxAuthority = "knowledge" | "ui-assist" | "prototype" | "governance";

export interface ToolboxPattern {
  id: string;
  source: ToolboxSource;
  title: string;
  summary: string;
  boundary: Extract<ProofBoundary, "candidate" | "diagnostic">;
  authority: ToolboxAuthority;
  disabledByDefault: boolean;
}

export const TOOLBOX_PATTERNS: ToolboxPattern[] = [
  {
    id: "knowledge-pack-factory",
    source: "openwiki",
    title: "KnowledgePackFactory",
    summary: "Maintains agent-readable repo knowledge packs from anchored evidence windows.",
    boundary: "diagnostic",
    authority: "knowledge",
    disabledByDefault: false,
  },
  {
    id: "knowledge-pack-manifest",
    source: "openwiki",
    title: "KnowledgePackManifest",
    summary: "Stores commit, source window, content hash, and stale status for knowledge packs.",
    boundary: "diagnostic",
    authority: "knowledge",
    disabledByDefault: false,
  },
  {
    id: "idempotent-context-fold",
    source: "openwiki",
    title: "IdempotentContextFold",
    summary: "Skips metadata churn when content hashes do not change.",
    boundary: "diagnostic",
    authority: "knowledge",
    disabledByDefault: false,
  },
  {
    id: "masked-secret-diagnostics",
    source: "openwiki",
    title: "MaskedSecretDiagnostics",
    summary: "Reports credential readiness without revealing secret values.",
    boundary: "diagnostic",
    authority: "knowledge",
    disabledByDefault: false,
  },
  {
    id: "cockpit-dom-agent",
    source: "page-agent",
    title: "CockpitDOMAgent",
    summary: "Builds simplified DOM snapshots for guided cockpit actions.",
    boundary: "candidate",
    authority: "ui-assist",
    disabledByDefault: true,
  },
  {
    id: "indexed-action-contract",
    source: "page-agent",
    title: "IndexedActionContract",
    summary:
      "Represents actions as element-indexed proposals that can be reviewed before execution.",
    boundary: "candidate",
    authority: "ui-assist",
    disabledByDefault: true,
  },
  {
    id: "reflection-before-action",
    source: "page-agent",
    title: "ReflectionBeforeAction",
    summary: "Requires plan and critique text before presenting an action candidate.",
    boundary: "candidate",
    authority: "ui-assist",
    disabledByDefault: true,
  },
  {
    id: "candidate-prototype-lab",
    source: "lovable",
    title: "CandidatePrototypeLab",
    summary: "Uses visual prototypes as candidate inputs only.",
    boundary: "candidate",
    authority: "prototype",
    disabledByDefault: false,
  },
  {
    id: "evidence-boundary-ledger",
    source: "wdc",
    title: "EvidenceBoundaryLedger",
    summary: "Labels every visible state as candidate, diagnostic, runtime, or claim.",
    boundary: "diagnostic",
    authority: "governance",
    disabledByDefault: false,
  },
];

export function getToolboxPatternsBySource(source: ToolboxSource): ToolboxPattern[] {
  return TOOLBOX_PATTERNS.filter((pattern) => pattern.source === source);
}
