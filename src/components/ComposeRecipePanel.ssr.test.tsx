import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComposeRecipePanel } from "@/components/ComposeRecipePanel";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";

describe("ComposeRecipePanel", () => {
  it("renders selected candidates with activation blocked", () => {
    const recipe = buildCapabilityRecipe("strategy cockpit", buildCapabilityLibrary().slice(0, 2));
    const html = renderToString(<ComposeRecipePanel recipe={recipe} />);

    expect(html).toContain("Compose");
    expect(html).toContain("expected_stop");
    expect(html).toContain("approval.gated.execution");
    expect(html).toContain("mapped 0");
  });
});
