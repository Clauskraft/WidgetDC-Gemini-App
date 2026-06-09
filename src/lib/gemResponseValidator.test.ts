import { describe, it, expect } from "vitest";
import { validateGemResponse, extractArtifacts } from "./gemResponseValidator";

const FLOW = (kinds: string[]) =>
  "```flow\n" +
  JSON.stringify({
    direction: "LR",
    nodes: kinds.map((k, i) => ({ id: `n${i}`, label: `N${i}`, kind: k })),
    edges: kinds.slice(0, -1).map((_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
  }) +
  "\n```";

const NOTES = `Canvas notes:
- alpha
- beta
- gamma
`;

describe("extractArtifacts", () => {
  it("parses flow + canvas notes + tables", () => {
    const text = `Intro

${FLOW(["StrategicInsight", "Claim", "Decision"])}

| Signal | NodeID | Unit | Sample-rate |
| --- | --- | --- | --- |
| temp | ns=2;i=42 | °C | 1 Hz |

${NOTES}`;
    const a = extractArtifacts(text);
    expect(a.flowBlocks).toHaveLength(1);
    expect(a.flowBlocks[0].kinds).toContain("Decision");
    expect(a.tables[0].headers).toContain("NodeID");
    expect(a.tables[0].rowCount).toBe(1);
    expect(a.canvasNotes).toEqual(["alpha", "beta", "gamma"]);
  });

  it("flags dangling edges", () => {
    const text =
      "```flow\n" +
      JSON.stringify({
        nodes: [{ id: "a", label: "A", kind: "Agent" }],
        edges: [{ from: "a", to: "ghost" }],
      }) +
      "\n```\n" +
      NOTES;
    const r = validateGemResponse(text, "consulting-strategist");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "flow_dangling_edge")).toBe(true);
  });
});

describe("consulting-strategist rules", () => {
  it("accepts a proper SCQA + flow + notes answer", () => {
    const text = `SCQA pitch first.

${FLOW(["StrategicInsight", "Claim", "Decision"])}

MECE issue tree above.

${NOTES}`;
    const r = validateGemResponse(text, "consulting-strategist");
    expect(r.ok).toBe(true);
  });

  it("warns when no framework signal is present", () => {
    const text = `Just some prose without keywords.

${FLOW(["Claim"])}

${NOTES}`;
    const r = validateGemResponse(text, "consulting-strategist");
    expect(r.issues.some((i) => i.code === "consulting_no_framework_signal")).toBe(true);
  });

  it("errors when canvas notes are missing", () => {
    const text = `MECE answer.\n\n${FLOW(["Decision"])}\n`;
    const r = validateGemResponse(text, "consulting-strategist");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "missing_canvas_notes")).toBe(true);
  });
});

describe("cyber-defender rules", () => {
  it("accepts threat-model flow with Agent + ComplianceGap", () => {
    const text = `STRIDE threat model for kill chain TTP T1078.004.

${FLOW(["Agent", "ComplianceGap", "GuardrailRule"])}

NIS2 Art. 21 mapping.

${NOTES}`;
    const r = validateGemResponse(text, "cyber-defender");
    expect(r.ok).toBe(true);
  });

  it("accepts answer with a Sigma detection rule instead of flow", () => {
    const text = `Detection logic for adversary T1558.003 kill chain.

\`\`\`yaml
title: Kerberoasting
detection:
  selection:
    EventID: 4769
\`\`\`

${NOTES}`;
    const r = validateGemResponse(text, "cyber-defender");
    expect(r.ok).toBe(true);
  });

  it("errors when neither threat-model nor detection is present", () => {
    const text = `Just talking about security.\n\n${NOTES}`;
    const r = validateGemResponse(text, "cyber-defender");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "cyber_missing_artifact")).toBe(true);
  });

  it("warns when attack mentioned but no ATT&CK ID", () => {
    const text = `Threat actor uses kill chain TTP for lateral movement.

${FLOW(["Agent", "ComplianceGap"])}

${NOTES}`;
    const r = validateGemResponse(text, "cyber-defender");
    expect(r.issues.some((i) => i.code === "cyber_missing_attack_id")).toBe(true);
  });
});

describe("lego-factory-architect rules", () => {
  it("accepts OPC-UA table + units", () => {
    const text = `Linje-design.

| Signal | NodeID | Semantic ID | Unit | Sample-rate |
| --- | --- | --- | --- | --- |
| t1 | ns=2;i=10 | 0173-1#01 | °C | 5 Hz |

Takt 18 s, cycle 22 s, OEE 78%.

${NOTES}`;
    const r = validateGemResponse(text, "lego-factory-architect");
    expect(r.ok).toBe(true);
  });

  it("errors on empty OPC-UA table", () => {
    const text = `Tom tabel.

| Signal | NodeID | Unit |
| --- | --- | --- |

${NOTES}`;
    const r = validateGemResponse(text, "lego-factory-architect");
    expect(r.issues.some((i) => i.code === "factory_empty_opcua_table")).toBe(true);
  });

  it("warns on OEE talk without SI units", () => {
    const text = `Vores OEE er lav og takt er forkert.

${FLOW(["Entity", "Tool"])}

${NOTES}`;
    const r = validateGemResponse(text, "lego-factory-architect");
    expect(r.issues.some((i) => i.code === "factory_missing_units")).toBe(true);
  });
});

describe("osint-analyst rules", () => {
  it("accepts pivot graph + Admiralty + BLUF", () => {
    const text = `BLUF: target ejes af X.

${FLOW(["Entity", "Evidence", "query"])}

Kilde [src#1] B2 reliability/credibility.

${NOTES}`;
    const r = validateGemResponse(text, "osint-analyst");
    expect(r.ok).toBe(true);
  });

  it("errors when neither pivot graph nor pivot plan is present", () => {
    const text = `Some prose without pivots.\n\n${NOTES}`;
    const r = validateGemResponse(text, "osint-analyst");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "osint_missing_pivot_structure")).toBe(true);
  });

  it("warns on unmarked realistic URLs", () => {
    const text = `Found infrastructure: https://acme-corp.com used by actor.

${FLOW(["Entity", "Evidence"])}

${NOTES}`;
    const r = validateGemResponse(text, "osint-analyst");
    expect(r.issues.some((i) => i.code === "osint_unverified_selector")).toBe(true);
  });

  it("does not warn when URLs are marked hypothetical", () => {
    const text = `Hypotetisk eksempel: https://acme-corp.com (kræver live query).

${FLOW(["Entity", "query"])}

${NOTES}`;
    const r = validateGemResponse(text, "osint-analyst");
    expect(r.issues.some((i) => i.code === "osint_unverified_selector")).toBe(false);
  });
});

describe("unknown gem", () => {
  it("only applies common rules", () => {
    const r = validateGemResponse("hello", "unknown-gem");
    expect(r.issues.some((i) => i.code === "missing_canvas_notes")).toBe(true);
    expect(r.issues.find((i) => i.code.startsWith("consulting_"))).toBeUndefined();
  });
});
