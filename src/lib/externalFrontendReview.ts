import type { WorldClassCategoryId } from "@/lib/worldClassContract";
import type { WorldClassKpiId } from "@/lib/worldClassKpiMatrix";

export type ExternalFrontendReviewAppId = "claude_design" | "v0_vercel" | "figma_make";

export type ExternalFrontendReviewAccessStatus = "ready" | "login_required" | "blocked";

export type ExternalFrontendReviewImportBackContract = {
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  provider_execution_allowed: false;
  mapped_count_allowed: false;
  runtime_claim_allowed: false;
  claim_promotion_allowed: false;
};

export type ExternalFrontendReviewApp = {
  id: ExternalFrontendReviewAppId;
  label: string;
  url: string;
  source_ref: string;
  access_status: ExternalFrontendReviewAccessStatus;
  role: "prototype_review" | "implementation_variant" | "design_system_review";
  fit_for: WorldClassCategoryId[];
  review_prompt: string;
  import_back_contract: ExternalFrontendReviewImportBackContract;
};

export type ExternalFrontendReviewRubricItem = {
  category: WorldClassCategoryId;
  label: string;
  weight: number;
  world_class_kpi_refs: WorldClassKpiId[];
  evidence_level_ceiling: "diagnostic_only";
  acceptance_signal: string;
};

export type ExternalFrontendReviewLoop = {
  review_loop_id: "external.frontend.review.worldclass.v0";
  task_bom_id: "taskbom:adaptive:533f9e462430";
  route_method: "MCP";
  target_surface: "Gemini App World-Class Capability Cockpit";
  gemini_primary_ux: true;
  consulting_frontend_role: "widget_artifact_foundry_only";
  apps: ExternalFrontendReviewApp[];
  scoring_rubric: ExternalFrontendReviewRubricItem[];
  stop_conditions: string[];
  candidate_count: number;
  mapped_count: 0;
  mapped_count_source: "graph_readback_only";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  provider_executions: 0;
};

export type ExternalFrontendReviewReadiness = {
  apps_total: number;
  apps_ready: number;
  apps_requiring_login: number;
  apps_blocked: number;
  provider_executions: 0;
  boundary_status: "candidate_only";
  can_run_without_governed_review_execution: false;
};

const boundary: ExternalFrontendReviewImportBackContract = {
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
  provider_execution_allowed: false,
  mapped_count_allowed: false,
  runtime_claim_allowed: false,
  claim_promotion_allowed: false,
};

const sharedPrompt =
  "Review the Gemini App World-Class Capability Cockpit as a candidate-only design input. " +
  "Use a no runtime proof boundary: do not execute providers, do not write graph data, and do not " +
  "convert candidate_count into mapped_count. Focus on world-class usability, visual hierarchy, " +
  "capability discovery, composition flow, proof clarity, and Foundry reuse.";

export const EXTERNAL_FRONTEND_REVIEW_LOOP: ExternalFrontendReviewLoop = {
  review_loop_id: "external.frontend.review.worldclass.v0",
  task_bom_id: "taskbom:adaptive:533f9e462430",
  route_method: "MCP",
  target_surface: "Gemini App World-Class Capability Cockpit",
  gemini_primary_ux: true,
  consulting_frontend_role: "widget_artifact_foundry_only",
  apps: [
    {
      id: "claude_design",
      label: "Claude Design",
      url: "https://claude.ai/design",
      source_ref: "https://claude.com/product/design",
      access_status: "ready",
      role: "prototype_review",
      fit_for: ["usability", "visual_quality", "proof_clarity"],
      review_prompt:
        `${sharedPrompt} Use Claude Design for on-brand prototype alternatives, inline design critique, ` +
        "and design-system fit. Return only candidate recommendations and a list of concrete UI deltas.",
      import_back_contract: boundary,
    },
    {
      id: "v0_vercel",
      label: "v0 by Vercel",
      url: "https://v0.app/",
      source_ref: "https://v0.app/",
      access_status: "login_required",
      role: "implementation_variant",
      fit_for: ["composition_power", "visual_quality", "performance"],
      review_prompt:
        `${sharedPrompt} Use v0 for an implementation-oriented component/layout variant. ` +
        "Return candidate component ideas, latency risks, and shadcn-compatible structure notes.",
      import_back_contract: boundary,
    },
    {
      id: "figma_make",
      label: "Figma Make",
      url: "https://www.figma.com/make/",
      source_ref: "https://www.figma.com/make/",
      access_status: "login_required",
      role: "design_system_review",
      fit_for: ["capability_discovery", "visual_quality", "reuse_and_foundry"],
      review_prompt:
        `${sharedPrompt} Use Figma Make for design-system compatible prototype and widget/artifact ` +
        "review. Return candidate visual structures and reusable slot opportunities only.",
      import_back_contract: boundary,
    },
  ],
  scoring_rubric: [
    {
      category: "usability",
      label: "User can identify the next action without raw JSON or governance confusion.",
      weight: 0.22,
      world_class_kpi_refs: ["next_action_clarity", "raw_json_avoidance", "first_useful_route"],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer identifies the same primary next action in the cockpit.",
    },
    {
      category: "visual_quality",
      label: "Layout is readable, non-overlapping, and suitable for repeated work.",
      weight: 0.2,
      world_class_kpi_refs: [
        "visual_sanity",
        "inspector_usefulness",
        "visual_artifact_readability",
      ],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer flags no blank panels, clipping, or unreadable states.",
    },
    {
      category: "capability_discovery",
      label: "Skills, agents, patterns, widgets, and routes are discoverable and combinable.",
      weight: 0.18,
      world_class_kpi_refs: ["category_coverage", "search_success", "metadata_completeness"],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer can locate and combine capabilities across required categories.",
    },
    {
      category: "composition_power",
      label: "Route, recipe, dependency, and expected-stop states are understandable.",
      weight: 0.16,
      world_class_kpi_refs: [
        "valid_recipe_rate",
        "boundary_correctness",
        "missing_dependency_visibility",
      ],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer can explain why activation is blocked and what is next.",
    },
    {
      category: "proof_clarity",
      label: "Candidate, mapped, proof, runtime, and approval boundaries stay visible.",
      weight: 0.14,
      world_class_kpi_refs: [
        "candidate_mapped_separation",
        "expected_stop_explanation",
        "runtime_overclaim_defects",
      ],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer does not confuse candidate evidence with proof.",
    },
    {
      category: "reuse_and_foundry",
      label: "Widget Foundry remains a reusable source, not a competing runtime shell.",
      weight: 0.1,
      world_class_kpi_refs: ["foundry_slot_reuse", "lego_bom_visibility"],
      evidence_level_ceiling: "diagnostic_only",
      acceptance_signal: "Reviewer identifies reusable slots without turning Foundry into the shell.",
    },
  ],
  stop_conditions: [
    "stop_if_external_output_claims_runtime_proof",
    "stop_if_review_requires_credentials_in_chat",
    "stop_if_provider_execution_is_requested_without_governed_review_execution",
    "stop_if_candidate_count_is_used_as_mapped_count",
    "stop_if_consulting_frontend_is_treated_as_primary_shell",
  ],
  candidate_count: 3,
  mapped_count: 0,
  mapped_count_source: "graph_readback_only",
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
  provider_executions: 0,
};

export function buildExternalFrontendReviewPlan(): ExternalFrontendReviewLoop {
  return {
    ...EXTERNAL_FRONTEND_REVIEW_LOOP,
    apps: EXTERNAL_FRONTEND_REVIEW_LOOP.apps.map((app) => ({
      ...app,
      import_back_contract: { ...app.import_back_contract },
    })),
    scoring_rubric: EXTERNAL_FRONTEND_REVIEW_LOOP.scoring_rubric.map((item) => ({ ...item })),
    stop_conditions: [...EXTERNAL_FRONTEND_REVIEW_LOOP.stop_conditions],
  };
}

export function summarizeExternalFrontendReviewReadiness(
  plan: ExternalFrontendReviewLoop = EXTERNAL_FRONTEND_REVIEW_LOOP,
): ExternalFrontendReviewReadiness {
  return {
    apps_total: plan.apps.length,
    apps_ready: plan.apps.filter((app) => app.access_status === "ready").length,
    apps_requiring_login: plan.apps.filter((app) => app.access_status === "login_required").length,
    apps_blocked: plan.apps.filter((app) => app.access_status === "blocked").length,
    provider_executions: 0,
    boundary_status: "candidate_only",
    can_run_without_governed_review_execution: false,
  };
}
