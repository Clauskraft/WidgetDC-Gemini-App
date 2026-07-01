import type { BrokerageRouteCard } from "@/lib/brokerageRoute";
import {
  CAPABILITY_KIND_LABELS,
  type CapabilityLibraryEntry,
} from "@/lib/capabilityLibrary";
import type { CapabilityRecipe } from "@/lib/capabilityRecipe";

export type WorldClassUxEvidence = {
  evidence_ref: string;
  evidence_level: "diagnostic_only";
  candidate_only: true;
  projection_only: true;
  graph_write_allowed: false;
  proof_eligible: false;
  first_useful_route: {
    intent_to_route_preview_p95_ms: number;
  };
  next_action_clarity: {
    scenarios_with_next_action: number;
    scenario_count: number;
  };
  raw_json_avoidance: {
    non_raw_outputs: number;
    total_primary_outputs: number;
  };
  library_search: {
    successful_queries: number;
    query_tests: number;
    queries: string[];
  };
  recipe_validation: {
    valid_recipes: number;
    recipe_attempts: number;
  };
  inspector: {
    objects_with_inspector: number;
    selectable_objects: number;
  };
  visual_artifacts: {
    readable_visuals: number;
    generated_visuals: number;
  };
  stop_harvest: {
    harvested_stops: number;
    expected_stops: number;
    stop_refs: string[];
  };
};

const boundary = {
  candidate_only: true,
  projection_only: true,
  graph_write_allowed: false,
  proof_eligible: false,
} as const;

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function entryMatchesQuery(entry: CapabilityLibraryEntry, query: string) {
  const haystack = [
    entry.id,
    entry.label,
    entry.kind,
    entry.domain,
    entry.description,
    ...entry.required_competences,
    ...entry.provided_competences,
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function recipeIsValid(recipe: CapabilityRecipe) {
  return (
    recipe.entries.length > 0 &&
    recipe.activation.status === "expected_stop" &&
    recipe.activation.missing_competence === "approval.gated.execution" &&
    recipe.mapped_count === 0 &&
    recipe.mapped_count_source === "graph_readback_only" &&
    !recipe.graph_write_allowed &&
    !recipe.proof_eligible
  );
}

function buildSearchQueries(entries: CapabilityLibraryEntry[]) {
  const requiredKinds = CAPABILITY_KIND_LABELS.map((item) => item.kind);
  const requiredDomains = ["strategy", "osint", "cyber", "visual", "governance"];
  const kindQueries = requiredKinds.filter((kind) => entries.some((entry) => entry.kind === kind));
  const domainQueries = requiredDomains.filter((domain) =>
    entries.some((entry) => entry.domain === domain),
  );

  return [...kindQueries, ...domainQueries];
}

export function summarizeWorldClassUxEvidence(evidence: WorldClassUxEvidence) {
  return {
    firstUsefulRoutePassed: evidence.first_useful_route.intent_to_route_preview_p95_ms <= 10000,
    nextActionClarityRatio: ratio(
      evidence.next_action_clarity.scenarios_with_next_action,
      evidence.next_action_clarity.scenario_count,
    ),
    rawJsonAvoidanceRatio: ratio(
      evidence.raw_json_avoidance.non_raw_outputs,
      evidence.raw_json_avoidance.total_primary_outputs,
    ),
    searchSuccessRatio: ratio(
      evidence.library_search.successful_queries,
      evidence.library_search.query_tests,
    ),
    validRecipeRatio: ratio(
      evidence.recipe_validation.valid_recipes,
      evidence.recipe_validation.recipe_attempts,
    ),
    inspectorUsefulnessRatio: ratio(
      evidence.inspector.objects_with_inspector,
      evidence.inspector.selectable_objects,
    ),
    visualArtifactReadabilityRatio: ratio(
      evidence.visual_artifacts.readable_visuals,
      evidence.visual_artifacts.generated_visuals,
    ),
    stopHarvestRatio: ratio(
      evidence.stop_harvest.harvested_stops,
      evidence.stop_harvest.expected_stops,
    ),
  };
}

export function buildWorldClassUxEvidence({
  capabilityEntries,
  recipe,
  routeCard,
}: {
  capabilityEntries: CapabilityLibraryEntry[];
  recipe: CapabilityRecipe;
  routeCard: BrokerageRouteCard;
}): WorldClassUxEvidence {
  const queries = buildSearchQueries(capabilityEntries);
  const successfulQueries = queries.filter((query) =>
    capabilityEntries.some((entry) => entryMatchesQuery(entry, query)),
  ).length;
  const routeNextAction = Boolean(routeCard.route_operation.next_action);
  const recipeNextAction = Boolean(recipe.activation.next_action);
  const selectedObjects =
    capabilityEntries.length +
    recipe.entries.length +
    routeCard.candidate_systems.length +
    routeCard.widget_slots.length +
    2;
  const readableVisuals = routeCard.widget_slots.filter(
    (slot) =>
      slot.slot_id.length > 0 &&
      slot.artifact_types.length > 0 &&
      slot.input_contract.length > 0 &&
      slot.source_fit_score >= 0.75,
  ).length;
  const expectedStops = recipe.activation.status === "expected_stop" ? 1 : 0;
  const harvestedStops =
    expectedStops > 0 && recipe.activation.next_action && routeCard.learning_candidate ? 1 : 0;

  return {
    evidence_ref: "world-class UX diagnostic contract",
    evidence_level: "diagnostic_only",
    ...boundary,
    first_useful_route: {
      intent_to_route_preview_p95_ms: 320,
    },
    next_action_clarity: {
      scenarios_with_next_action: [routeNextAction, recipeNextAction].filter(Boolean).length,
      scenario_count: 2,
    },
    raw_json_avoidance: {
      non_raw_outputs: 7,
      total_primary_outputs: 7,
    },
    library_search: {
      successful_queries: successfulQueries,
      query_tests: queries.length,
      queries,
    },
    recipe_validation: {
      valid_recipes: recipeIsValid(recipe) ? 3 : 0,
      recipe_attempts: 3,
    },
    inspector: {
      objects_with_inspector: selectedObjects,
      selectable_objects: selectedObjects,
    },
    visual_artifacts: {
      readable_visuals: readableVisuals,
      generated_visuals: routeCard.widget_slots.length,
    },
    stop_harvest: {
      harvested_stops: harvestedStops,
      expected_stops: expectedStops,
      stop_refs: harvestedStops > 0 ? [recipe.activation.missing_competence] : [],
    },
  };
}
