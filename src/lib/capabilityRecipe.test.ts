import { describe, expect, it } from "vitest";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";

describe("capabilityRecipe", () => {
  it("composes selected candidates without making proof or execution claims", () => {
    const library = buildCapabilityLibrary();
    const selected = library.filter((entry) =>
      [
        "agent:consulting-strategist",
        "widget.slot.vibe-canvas",
        "proof_gate:approval_gated_execution",
      ].includes(entry.id),
    );
    const recipe = buildCapabilityRecipe("strategy cockpit", selected);

    expect(recipe.intent).toBe("strategy cockpit");
    expect(recipe.candidate_count).toBe(3);
    expect(recipe.mapped_count).toBe(0);
    expect(recipe.mapped_count_source).toBe("graph_readback_only");
    expect(recipe.activation.status).toBe("expected_stop");
    expect(recipe.activation.missing_competence).toBe("approval.gated.execution");
    expect(recipe.approval_readiness.status).toBe("expected_stop");
    expect(recipe.approval_readiness.ui_execution_enabled).toBe(false);
    expect(recipe.approval_readiness.blocked_actions).toContain("execute provider");
    expect(recipe.approval_readiness.provider_executions).toBe(0);
    expect(recipe.graph_write_allowed).toBe(false);
    expect(recipe.proof_eligible).toBe(false);
  });
});
