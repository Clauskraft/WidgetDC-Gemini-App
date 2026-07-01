import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WDCObjectCard } from "./WDCObjectCard";
import { resolveAgentOfficeProductionLoop } from "@/lib/agentOfficeProductionLoop";
import { buildWDCObjectCards } from "@/lib/wdcObjectCards";

describe("WDCObjectCard", () => {
  it("renders readable cards with collapsed details and no raw JSON default", () => {
    const [card] = buildWDCObjectCards(resolveAgentOfficeProductionLoop("operate"));
    const html = renderToString(<WDCObjectCard card={card} />);

    expect(html).toContain("Proof boundary");
    expect(html).toContain(card.title);
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).not.toContain("{&quot;");
  });
});
