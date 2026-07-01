import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibraryNav } from "@/components/LibraryNav";

describe("LibraryNav", () => {
  it("renders capability categories", () => {
    const html = renderToString(
      <LibraryNav
        filters={{ kind: "agent", domain: "all", readiness: "all", evidence: "all", query: "" }}
        onChange={() => undefined}
      />,
    );

    expect(html).toContain("Agents");
    expect(html).toContain("Patterns");
    expect(html).toContain("Widgets");
    expect(html).toContain("Proof gates");
    expect(html).toContain("Style profiles");
    expect(html).toContain("Visual strategies");
    expect(html).toContain("Search capabilities");
    expect(html).toContain("Filter capability evidence");
  });
});
