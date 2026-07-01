import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibraryNav } from "@/components/LibraryNav";

describe("LibraryNav", () => {
  it("renders capability categories", () => {
    const html = renderToString(<LibraryNav activeKind="agent" onSelectKind={() => undefined} />);

    expect(html).toContain("Agents");
    expect(html).toContain("Patterns");
    expect(html).toContain("Widgets");
    expect(html).toContain("Proof gates");
  });
});
