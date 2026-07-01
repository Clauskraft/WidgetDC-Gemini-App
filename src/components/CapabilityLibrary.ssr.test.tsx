import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CapabilityLibrary } from "@/components/CapabilityLibrary";
import { buildCapabilityLibrary } from "@/lib/capabilityLibrary";

describe("CapabilityLibrary", () => {
  it("renders candidate boundaries", () => {
    const entries = buildCapabilityLibrary();
    const html = renderToString(
      <CapabilityLibrary
        entries={entries}
        activeKind="widget"
        selectedIds={[]}
        onToggle={() => undefined}
      />,
    );

    expect(html).toContain("candidate-only");
    expect(html).toContain("graph write: blocked");
    expect(html).toContain("Widget");
  });
});
