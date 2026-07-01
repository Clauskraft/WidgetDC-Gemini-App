import { GEMS } from "@/lib/gems";
import { VISUALIZATION_STANDARDS } from "@/lib/visualizationIntent";
import { WIDGET_FOUNDRY_SLOT_CANDIDATES } from "@/lib/widgetFoundryBridge";
import { WORK_MODES } from "@/lib/workModes";

export type CapabilityKind =
  | "skill"
  | "agent"
  | "pattern"
  | "widget"
  | "route"
  | "proof_gate"
  | "work_mode"
  | "style_profile"
  | "visual_strategy";

export type CapabilityDomain =
  | "consulting"
  | "strategy"
  | "cyber"
  | "osint"
  | "app-building"
  | "devops"
  | "document"
  | "visual"
  | "governance";

export type CapabilityExtractionContract = {
  extraction_mode: "read_only_capability_inventory";
  validation_status: "candidate_only";
  required_fields: ["source_fit_score", "extraction_contract"];
};

export type CapabilityReadiness =
  | "preview_ready"
  | "dry_run_only"
  | "approval_required"
  | "missing_dependency";

export type CapabilityEvidence =
  | "local_candidate"
  | "source_backed_candidate"
  | "graph_readback"
  | "runtime_proof";

export type CapabilityLibraryFilters = {
  kind: CapabilityKind;
  domain: CapabilityDomain | "all";
  readiness: CapabilityReadiness | "all";
  evidence: CapabilityEvidence | "all";
  query: string;
};

export type CapabilityLibraryEntry = {
  id: string;
  label: string;
  kind: CapabilityKind;
  domain: CapabilityDomain;
  description: string;
  source_repo: "WidgetDC-Gemini-App" | "widgetdc-consulting-frontend" | "WidgeTDC";
  source_ref: string;
  required_competences: string[];
  provided_competences: string[];
  source_fit_score: number;
  extraction_contract: CapabilityExtractionContract;
  readiness: CapabilityReadiness;
  evidence: CapabilityEvidence;
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
};

export const CAPABILITY_KIND_LABELS: ReadonlyArray<{ kind: CapabilityKind; label: string }> = [
  { kind: "skill", label: "Skills" },
  { kind: "agent", label: "Agents" },
  { kind: "pattern", label: "Patterns" },
  { kind: "widget", label: "Widgets" },
  { kind: "route", label: "Routes" },
  { kind: "proof_gate", label: "Proof gates" },
  { kind: "work_mode", label: "Work modes" },
  { kind: "style_profile", label: "Style profiles" },
  { kind: "visual_strategy", label: "Visual strategies" },
];

export const CAPABILITY_DOMAINS: ReadonlyArray<CapabilityDomain> = [
  "consulting",
  "strategy",
  "cyber",
  "osint",
  "app-building",
  "devops",
  "document",
  "visual",
  "governance",
];

export const CAPABILITY_READINESS: ReadonlyArray<CapabilityReadiness> = [
  "preview_ready",
  "dry_run_only",
  "approval_required",
  "missing_dependency",
];

export const CAPABILITY_EVIDENCE: ReadonlyArray<CapabilityEvidence> = [
  "local_candidate",
  "source_backed_candidate",
  "graph_readback",
  "runtime_proof",
];

const boundary = {
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
} as const;

const extraction_contract: CapabilityExtractionContract = {
  extraction_mode: "read_only_capability_inventory",
  validation_status: "candidate_only",
  required_fields: ["source_fit_score", "extraction_contract"],
};

function domainForGem(id: string): CapabilityDomain {
  if (id.includes("cyber")) return "cyber";
  if (id.includes("osint")) return "osint";
  if (id.includes("lego")) return "app-building";
  return "strategy";
}

function domainForWorkMode(id: string): CapabilityDomain {
  if (id === "app") return "app-building";
  if (id === "book") return "document";
  if (id === "investigation") return "osint";
  if (id === "operate") return "governance";
  return "consulting";
}

function entry(
  values: Omit<
    CapabilityLibraryEntry,
    | "candidate_only"
    | "projection_only"
    | "graph_write_allowed"
    | "proof_eligible"
    | "extraction_contract"
  >,
): CapabilityLibraryEntry {
  return {
    ...values,
    extraction_contract,
    ...boundary,
  };
}

export function buildCapabilityLibrary(): CapabilityLibraryEntry[] {
  const skills = [
    ["skill:brainstorming", "Brainstorming", "Creative option generation before design work."],
    ["skill:executing-plans", "Executing plans", "Task-by-task execution with verification."],
    [
      "skill:implementation-loop-guardian",
      "Implementation loop guardian",
      "Prevents stuck loops and incomplete closeout.",
    ],
    [
      "skill:octopus-architecture",
      "Octopus architecture",
      "Cross-repo architecture assessment and API design.",
    ],
  ].map(([id, label, description]) =>
    entry({
      id,
      label,
      kind: "skill",
      domain: "governance",
      description,
      source_repo: "WidgeTDC",
      source_ref: "superpowers://skills",
      required_competences: ["skill.selection", "context.hydration"],
      provided_competences: [id.replace("skill:", "skill.")],
      source_fit_score: 0.84,
      readiness: "dry_run_only",
      evidence: "local_candidate",
    }),
  );

  const agents = GEMS.map((gem) =>
    entry({
      id: `agent:${gem.id}`,
      label: gem.name,
      kind: "agent",
      domain: domainForGem(gem.id),
      description: gem.description,
      source_repo: "WidgetDC-Gemini-App",
      source_ref: "src/lib/gems.ts",
      required_competences: ["intent.interpretation", "artifact.synthesis"],
      provided_competences: [`agent.${gem.id}`, "visual.response.contract"],
      source_fit_score: 0.9,
      readiness: "preview_ready",
      evidence: "local_candidate",
    }),
  );

  const workModes = WORK_MODES.map((mode) =>
    entry({
      id: `work_mode:${mode.id}`,
      label: mode.label,
      kind: "work_mode",
      domain: domainForWorkMode(mode.id),
      description: mode.description,
      source_repo: "WidgetDC-Gemini-App",
      source_ref: "src/lib/workModes.ts",
      required_competences: ["mode.selection"],
      provided_competences: [`work_mode.${mode.id}`],
      source_fit_score: 0.86,
      readiness: "preview_ready",
      evidence: "local_candidate",
    }),
  );

  const patterns = [
    ["pattern:runtime-truth", "Runtime Truth", "Verify claims through live readback."],
    ["pattern:evidence-gated", "Evidence-Gated", "Keep claims bounded by evidence."],
    ["pattern:canary-skeptic", "Canary Skeptic", "Challenge weak success signals."],
    ["pattern:zipfold-harvest", "ZipFold Harvest", "Harvest reusable learning from stops."],
    ["pattern:project-tree-gate", "ProjectTree Gate", "Frame every activity start and closeout."],
  ].map(([id, label, description]) =>
    entry({
      id,
      label,
      kind: "pattern",
      domain: "governance",
      description,
      source_repo: "WidgeTDC",
      source_ref: "docs/superpowers/specs/2026-07-01-world-class-capability-cockpit-design.md",
      required_competences: ["proof.boundary"],
      provided_competences: [id.replace("pattern:", "pattern.")],
      source_fit_score: 0.84,
      readiness: "dry_run_only",
      evidence: "local_candidate",
    }),
  );

  const routes = [
    ["route:wdc.route_validate", "WDC route validation", "Select governed execution route."],
    [
      "route:wdc.capability_chain.resolve",
      "Capability-chain resolve",
      "Resolve demand to capability candidates.",
    ],
    ["route:wdc.approval.request", "Approval request", "Request governed execution approval."],
  ].map(([id, label, description]) =>
    entry({
      id,
      label,
      kind: "route",
      domain: "governance",
      description,
      source_repo: "WidgeTDC",
      source_ref: "apps/cli/src/index.ts",
      required_competences: ["wdc.cli"],
      provided_competences: [id.replace("route:", "route.")],
      source_fit_score: 0.88,
      readiness: id.includes("approval") ? "approval_required" : "dry_run_only",
      evidence: "source_backed_candidate",
    }),
  );

  const proofGates = [
    [
      "proof_gate:candidate_only",
      "Candidate-only boundary",
      "Prevents projections from becoming proof.",
    ],
    [
      "proof_gate:approval_gated_execution",
      "Approval-gated execution",
      "Blocks execution until approved.",
    ],
    [
      "proof_gate:runtime_readback",
      "Runtime readback",
      "Requires deployed SHA and repeated verification.",
    ],
  ].map(([id, label, description]) =>
    entry({
      id,
      label,
      kind: "proof_gate",
      domain: "governance",
      description,
      source_repo: "WidgeTDC",
      source_ref: "docs/superpowers/specs/2026-07-01-world-class-capability-cockpit-design.md",
      required_competences: ["proof.gate.visibility"],
      provided_competences: [id.replace("proof_gate:", "proof_gate.")],
      source_fit_score: 0.91,
      readiness: id.includes("approval") ? "missing_dependency" : "preview_ready",
      evidence: "source_backed_candidate",
    }),
  );

  const widgets = WIDGET_FOUNDRY_SLOT_CANDIDATES.map((slot) =>
    entry({
      id: slot.slot_id,
      label: slot.label,
      kind: "widget",
      domain: slot.domain,
      description: slot.description,
      source_repo: "widgetdc-consulting-frontend",
      source_ref: slot.source_ref,
      required_competences: slot.required_competences,
      provided_competences: slot.provided_competences,
      source_fit_score: slot.source_fit_score,
      readiness: "preview_ready",
      evidence: "source_backed_candidate",
    }),
  );

  const styleProfiles = [
    ["style_profile:executive-strategy", "Executive strategy", "Boardroom-ready strategy artifacts."],
    ["style_profile:technical-architecture", "Technical architecture", "Precise system and API diagrams."],
    ["style_profile:osint-brief", "OSINT intelligence brief", "Source-forward intelligence summaries."],
    ["style_profile:cyber-threat-model", "Cyber threat model", "Risk, attack surface and controls visuals."],
    ["style_profile:lego-factory", "Manufacturing / LEGO factory", "Reusable block and route assembly views."],
    ["style_profile:boardroom-report", "Boardroom report", "Dense executive report and slide structure."],
  ].map(([id, label, description]) =>
    entry({
      id,
      label,
      kind: "style_profile",
      domain: id.includes("osint")
        ? "osint"
        : id.includes("cyber")
          ? "cyber"
          : id.includes("architecture")
            ? "devops"
            : id.includes("lego")
              ? "app-building"
              : "strategy",
      description,
      source_repo: "WidgeTDC",
      source_ref: "docs/superpowers/specs/2026-07-01-world-class-capability-cockpit-design.md",
      required_competences: ["style.selection", "artifact.intent"],
      provided_competences: [id.replace("style_profile:", "style_profile.")],
      source_fit_score: 0.87,
      readiness: "preview_ready",
      evidence: "source_backed_candidate",
    }),
  );

  const visualStrategies = Object.values(VISUALIZATION_STANDARDS).map((standard) =>
    entry({
      id: `visual_strategy:${standard.intent}`,
      label: standard.label,
      kind: "visual_strategy",
      domain:
        standard.intent === "business-process"
          ? "consulting"
          : standard.intent === "data-flow" || standard.intent === "data-model"
            ? "document"
            : "visual",
      description: `Intent ${standard.intent} resolves to ${standard.family} / ${standard.mermaidType}.`,
      source_repo: "WidgetDC-Gemini-App",
      source_ref: "src/lib/visualizationIntent.ts",
      required_competences: ["visual.intent", "style.profile"],
      provided_competences: [
        `visual_strategy.${standard.intent}`,
        `visual_family.${standard.family}`,
      ],
      source_fit_score: 0.9,
      readiness: "preview_ready",
      evidence: "source_backed_candidate",
    }),
  );

  return [
    ...skills,
    ...agents,
    ...patterns,
    ...widgets,
    ...routes,
    ...proofGates,
    ...workModes,
    ...styleProfiles,
    ...visualStrategies,
  ];
}

export function filterCapabilityLibrary(
  entries: CapabilityLibraryEntry[],
  filters: CapabilityLibraryFilters,
): CapabilityLibraryEntry[] {
  const terms = filters.query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  return entries.filter((entry) => {
    if (entry.kind !== filters.kind) return false;
    if (filters.domain !== "all" && entry.domain !== filters.domain) return false;
    if (filters.readiness !== "all" && entry.readiness !== filters.readiness) return false;
    if (filters.evidence !== "all" && entry.evidence !== filters.evidence) return false;
    if (terms.length === 0) return true;

    const haystack = [
      entry.id,
      entry.label,
      entry.kind,
      entry.domain,
      entry.description,
      entry.source_repo,
      entry.source_ref,
      entry.readiness,
      entry.evidence,
      ...entry.required_competences,
      ...entry.provided_competences,
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}
