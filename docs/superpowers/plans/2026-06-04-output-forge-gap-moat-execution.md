# Output Forge Gap Moat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Output Forge from a simple output generator into a best-practice consulting workspace with resizeable canvas, strategic zoom, gap reports, trust checks, framework structure, and reproducibility signals.

**Architecture:** Preserve the current ArchitectGPT two-pane chat/canvas layout. Add small, composable capabilities around the existing `Canvas` component, `OutputForgeType` contract, and `/api/widgetdc/route` deterministic BFF route. No modal output, no iframe preview, no hardcoded runtime model.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Express BFF in `server.ts`, Node 22 built-in `fetch` for smoke tests, Playwright/browser verification after implementation.

---

## Execution Chain

```text
harvest-to-pattern-library
-> visualization-system-loop
-> consulting-structure-layer
-> trust-ready-to-share-gate
-> data-reproducibility-layer
-> adoption-flywheel
```

## Subagent Model

Use `superpowers:subagent-driven-development`.

For every task:

```text
Implementer subagent
-> Spec compliance reviewer subagent
-> Code quality reviewer subagent
-> Controller verification
```

Do not dispatch two workers to the same files at the same time.

## Pattern Map

| Pattern                      | Purpose                                             | Owned By                   |
| ---------------------------- | --------------------------------------------------- | -------------------------- |
| `harvest-to-pattern-library` | Convert observed gaps into reusable output patterns | Gap/Pattern Agent          |
| `visualization-system-loop`  | Improve canvas usability, resize, zoom, overview    | UX Workspace Agent         |
| `consulting-structure-layer` | Add SCR, issue tree, options, recommendation logic  | Consulting Framework Agent |
| `trust-ready-to-share-gate`  | Translate faithfulness into user value              | Trust/Evidence Agent       |
| `data-reproducibility-layer` | Add dataset/transform/eval placeholders             | Data Science Agent         |
| `adoption-flywheel`          | Capture successful chains for future suggestions    | Adoption Agent             |

---

## File Structure

Modify:

- `src/App.tsx`  
  Owns Output Forge type list, prompt priming, canvas status state, chat/canvas shell layout.

- `src/components/Canvas.tsx`  
  Owns canvas header controls, preview/edit surface, canvas width/fullscreen-like workspace state without modal or iframe.

- `server.ts`  
  Owns deterministic Output Forge route, output types, status semantics, `_canvas_content`, `_canvas_language`, `_output_status`, `_output_type`.

- `WidgeTDC_Improvements.md`  
  Owns product-level TODO list and moat backlog.

Create:

- `scripts/smoke/output_forge_gap_smoke.cjs`  
  API smoke test for Output Forge type routing and no-model behavior.

- `scripts/smoke/output_forge_ui_smoke.cjs`  
  Optional browser-smoke instructions file if Playwright CLI is added later. Until then, use MCP/browser verification.

Do not modify:

- `dist/**` except via `npm run build`
- `node_modules/**`
- unrelated docs

---

## Task 1: Smoke Test Contract Before Implementation

**Subagent:** Gap/Pattern Agent  
**Pattern:** `harvest-to-pattern-library`  
**Files:**

- Create: `scripts/smoke/output_forge_gap_smoke.cjs`

- [ ] **Step 1: Create failing smoke test**

Create `scripts/smoke/output_forge_gap_smoke.cjs`:

```js
const base = process.argv[2] || "http://127.0.0.1:3022";

const flows = [
  {
    name: "gap_report",
    query:
      "Generate Output Forge Gap Report using symptom principle complaint moat acceptance test",
    expectedTarget: "output_forge.gap",
    expectedStatus: "Grounded",
    expectedType: "Gap Report",
    expectedText: ["Best-practice principle", "Expected complaint", "Moat", "Acceptance test"],
  },
  {
    name: "trust_check",
    query: "Generate Output Forge Trust Check for this client-ready artifact",
    expectedTarget: "output_forge.trust",
    expectedStatus: "Needs review",
    expectedType: "Trust Check",
    expectedText: ["Ready to share", "Needs source", "Assumption", "What should I check"],
  },
  {
    name: "consulting_structure",
    query: "Generate Output Forge Consulting Structure using SCR MECE issue tree recommendation",
    expectedTarget: "output_forge.consulting",
    expectedStatus: "Grounded",
    expectedType: "Consulting Structure",
    expectedText: ["Situation", "Complication", "Key question", "Recommendation"],
  },
  {
    name: "reproducibility",
    query: "Generate Output Forge Reproducibility Pack for the data analysis",
    expectedTarget: "output_forge.reproducibility",
    expectedStatus: "Needs review",
    expectedType: "Reproducibility Pack",
    expectedText: ["Dataset snapshot", "Transform trace", "Eval metadata", "Notebook export"],
  },
];

async function postJson(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

const failures = [];

for (const flow of flows) {
  const result = await postJson("/api/widgetdc/route", {
    tool: "intent_detect",
    payload: { query: flow.query },
  });

  const text = `${result.json.intent || ""}\n${result.json._canvas_content || ""}`;
  if (!result.ok) failures.push(`${flow.name}: HTTP ${result.status}`);
  if (result.json._target_tool !== flow.expectedTarget) {
    failures.push(
      `${flow.name}: expected target ${flow.expectedTarget}, got ${result.json._target_tool}`,
    );
  }
  if (result.json._output_status !== flow.expectedStatus) {
    failures.push(
      `${flow.name}: expected status ${flow.expectedStatus}, got ${result.json._output_status}`,
    );
  }
  if (result.json._output_type !== flow.expectedType) {
    failures.push(
      `${flow.name}: expected type ${flow.expectedType}, got ${result.json._output_type}`,
    );
  }
  if (!result.json._canvas_content) failures.push(`${flow.name}: missing _canvas_content`);
  for (const expected of flow.expectedText) {
    if (!text.includes(expected)) failures.push(`${flow.name}: missing text "${expected}"`);
  }
}

const noModel = await postJson("/api/chat", { contents: "hello" });
if (
  noModel.status !== 401 &&
  !String(noModel.json.text || "").includes("No runtime model is configured")
) {
  failures.push("chat_no_model: expected 401 unauthenticated or no-runtime-model text");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Output Forge gap smoke passed for ${base}`);
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
```

Expected before implementation:

```text
gap_report: expected target output_forge.gap, got output_forge.report
trust_check: expected target output_forge.trust, got output_forge.plan
consulting_structure: expected target output_forge.consulting, got output_forge.plan
reproducibility: expected target output_forge.reproducibility, got output_forge.plan
```

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke/output_forge_gap_smoke.cjs
git commit -m "test: add output forge gap smoke contract"
```

---

## Task 2: Extend Output Forge Contract

**Subagent:** Output Contract Agent  
**Pattern:** `standard-to-implementation`  
**Files:**

- Modify: `server.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update server output type union**

In `server.ts`, change:

```ts
type OutputForgeType = "Plan" | "Diagram" | "Report" | "Deck" | "Risk" | "Dashboard";
```

to:

```ts
type OutputForgeType =
  | "Plan"
  | "Diagram"
  | "Report"
  | "Deck"
  | "Risk"
  | "Dashboard"
  | "Gap Report"
  | "Trust Check"
  | "Consulting Structure"
  | "Reproducibility Pack";
```

Set:

```ts
const OUTPUT_FORGE_TYPES: OutputForgeType[] = [
  "Plan",
  "Diagram",
  "Report",
  "Deck",
  "Risk",
  "Dashboard",
  "Gap Report",
  "Trust Check",
  "Consulting Structure",
  "Reproducibility Pack",
];
```

- [ ] **Step 2: Update detection rules**

Inside `detectOutputForgeType`, after `const normalized = query.toLowerCase();`, use this order:

```ts
if (/\b(gap|gaps|best.practice|complaint|moat)\b/.test(normalized)) return "Gap Report";
if (/\b(trust|ready.to.share|faithfulness|source.check|confidence)\b/.test(normalized))
  return "Trust Check";
if (/\b(scr|mece|issue.tree|consulting.structure|recommendation)\b/.test(normalized))
  return "Consulting Structure";
if (/\b(reproducibility|notebook|dataset|transform|eval)\b/.test(normalized))
  return "Reproducibility Pack";
if (/\b(riec|risk)\b/.test(normalized)) return "Risk";
if (/\b(deck|slides?|pptx)\b/.test(normalized)) return "Deck";
if (/\b(dashboard|metrics|summary)\b/.test(normalized)) return "Dashboard";
if (/\b(mermaid|diagram|flowchart)\b/.test(normalized)) return "Diagram";
if (/\b(report|markdown|brief)\b/.test(normalized)) return "Report";
return "Plan";
```

- [ ] **Step 3: Add deterministic output content**

Add four entries to `outputs` in `buildOutputForgeResponse`:

```ts
"Gap Report": {
  language: "markdown",
  content: [
    `# ${title}`,
    "",
    `**Status:** ${status}`,
    "",
    "## Gap Method",
    "| Symptom | Best-practice principle | Expected complaint | Moat | Acceptance test |",
    "| --- | --- | --- | --- | --- |",
    "| Canvas cannot be resized | Complex artifact workspaces need user-controlled layout allocation | I cannot see the whole diagram while chat takes space | Consultant-grade delivery workspace | Resize canvas, collapse chat, restore default without losing state |",
    "| No strategic zoom | Large artifacts need overview and detail navigation | I lose the big picture | Strategic zoom over artifacts, claims, risks and evidence | Zoom to fit, zoom into a framework, return to overview |",
    "| Flat output blocks | Generated artifacts need block-level provenance | Where did this conclusion come from? | Evidence-native Output Forge | Every important block can show source, confidence and missing-evidence state |",
  ].join("\n"),
},
"Trust Check": {
  language: "markdown",
  content: [
    `# ${title}`,
    "",
    `**Status:** ${status}`,
    "",
    "## Ready to Share",
    "- Ready to share: No",
    "- Needs source: Claims without attached evidence",
    "- Assumption: Strategic recommendations not yet verified against graph lineage",
    "- What should I check: Numbers, named entities, data freshness, and client-sensitive claims",
    "",
    "## User Value",
    "The user does not ask for a faithfulness gate. The user asks whether the output can be trusted before sharing.",
  ].join("\n"),
},
"Consulting Structure": {
  language: "markdown",
  content: [
    `# ${title}`,
    "",
    `**Status:** ${status}`,
    "",
    "## SCR",
    "- Situation: Current artifact generation is fast but not yet structured as decision material.",
    "- Complication: Users need clarity, evidence, recommendation logic and client-ready framing.",
    "- Resolution: Apply consulting structure before export.",
    "",
    "## Issue Tree",
    "- What is the decision?",
    "- What evidence supports each option?",
    "- What trade-offs matter?",
    "- What recommendation follows?",
    "",
    "## Recommendation",
    "Use consulting structure as the default presentation layer over Output Forge artifacts.",
  ].join("\n"),
},
"Reproducibility Pack": {
  language: "markdown",
  content: [
    `# ${title}`,
    "",
    `**Status:** ${status}`,
    "",
    "## Reproducibility Checklist",
    "- Dataset snapshot: pending",
    "- Transform trace: pending",
    "- Eval metadata: pending",
    "- Notebook export: pending",
    "- Query and prompt lineage: captured in request envelope",
    "",
    "## Data Scientist Value",
    "A data scientist can inspect how an output was produced instead of treating the artifact as unreviewable AI prose.",
  ].join("\n"),
},
```

- [ ] **Step 4: Set status mapping**

Change status computation to:

```ts
const status =
  type === "Risk" || type === "Trust Check" || type === "Reproducibility Pack"
    ? "Needs review"
    : type === "Dashboard"
      ? "Validated"
      : "Grounded";
```

- [ ] **Step 5: Update frontend output type union**

In `src/App.tsx`, make the same `OutputForgeType` union extension.

- [ ] **Step 6: Add UI prompts**

In `outputForgeTypes`, append:

```tsx
{ type: "Gap Report", prompt: "Generate Output Forge Gap Report using symptom -> best-practice principle -> expected complaint -> moat -> acceptance test." },
{ type: "Trust Check", prompt: "Generate Output Forge Trust Check that explains Ready to share, Needs source, Assumption, and What should I check before sharing." },
{ type: "Consulting Structure", prompt: "Generate Output Forge Consulting Structure using SCR, MECE, issue tree, options, trade-offs, and recommendation." },
{ type: "Reproducibility Pack", prompt: "Generate Output Forge Reproducibility Pack with dataset snapshot, transform trace, eval metadata, notebook export, and prompt lineage." },
```

- [ ] **Step 7: Run GREEN smoke test**

Start dev server:

```powershell
$env:PORT='3022'; $env:ALLOW_DEV_AUTH_BYPASS='true'; npm run dev
```

In another shell:

```bash
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
npm run lint
```

Expected:

```text
Output Forge gap smoke passed for http://127.0.0.1:3022
```

- [ ] **Step 8: Commit**

```bash
git add server.ts src/App.tsx
git commit -m "feat: add output forge gap and trust contracts"
```

---

## Task 3: Canvas Workspace Controls

**Subagent:** UX Workspace Agent  
**Pattern:** `visualization-system-loop`  
**Best practices:** User-controlled layout allocation, zoom-to-fit, reversible workspace changes, no modal output.

**Files:**

- Modify: `src/components/Canvas.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Canvas sizing props**

In `CanvasProps`, add:

```ts
size?: "default" | "wide" | "focus";
onSizeChange?: (size: "default" | "wide" | "focus") => void;
```

In the function signature, set defaults:

```ts
size = "default",
onSizeChange,
```

- [ ] **Step 2: Replace fixed width class**

Replace current open width class:

```ts
? "w-full md:w-[500px] lg:w-[600px] xl:w-[700px] h-full shrink-0 border-l border-[#2A2B32]/30 shadow-2xl"
```

with:

```ts
? cn(
    "w-full h-full shrink-0 border-l border-[#2A2B32]/30 shadow-2xl",
    size === "default" && "md:w-[500px] lg:w-[600px] xl:w-[700px]",
    size === "wide" && "md:w-[70vw]",
    size === "focus" && "md:w-[calc(100vw-72px)]"
  )
```

- [ ] **Step 3: Add header controls**

Import icons:

```ts
import { Maximize2, Minimize2, PanelRightClose } from "lucide-react";
```

Add buttons before Copy:

```tsx
{
  onSizeChange && (
    <>
      <button
        onClick={() => onSizeChange(size === "wide" ? "default" : "wide")}
        className="p-1.5 hover:bg-[#2A2B32] rounded-md transition-colors text-[#A1A1A8]"
        title={size === "wide" ? "Restore Canvas Width" : "Widen Canvas"}
      >
        {size === "wide" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      <button
        onClick={() => onSizeChange(size === "focus" ? "default" : "focus")}
        className="p-1.5 hover:bg-[#2A2B32] rounded-md transition-colors text-[#A1A1A8]"
        title={size === "focus" ? "Restore Workspace" : "Focus Canvas"}
      >
        <PanelRightClose className="w-4 h-4" />
      </button>
    </>
  );
}
```

- [ ] **Step 4: Wire App state**

In `src/App.tsx`, add:

```ts
const [canvasSize, setCanvasSize] = useState<"default" | "wide" | "focus">("default");
```

Update Canvas:

```tsx
<Canvas
  isOpen={isCanvasOpen}
  onClose={() => setIsCanvasOpen(false)}
  content={canvasContent}
  onChange={setCanvasContent}
  language={canvasLanguage}
  onNodeClick={setHighlightedNode}
  highlightedNode={highlightedNode}
  size={canvasSize}
  onSizeChange={setCanvasSize}
/>
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual browser acceptance:

```text
Open http://127.0.0.1:3022
Click Output Forge Plan
Click Widen Canvas
Expected: canvas expands, chat remains visible
Click Focus Canvas
Expected: canvas becomes dominant surface without modal/iframe
Click Restore
Expected: default layout returns and artifact content remains
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Canvas.tsx src/App.tsx
git commit -m "feat: add canvas workspace controls"
```

---

## Task 4: Strategic Zoom and Layer Placeholders

**Subagent:** UX Workspace Agent  
**Pattern:** `visualization-system-loop`  
**Files:**

- Modify: `src/components/Canvas.tsx`

- [ ] **Step 1: Add zoom and layer state**

Inside `Canvas`, add:

```ts
const [zoom, setZoom] = useState(1);
const [visibleLayers, setVisibleLayers] = useState({
  narrative: true,
  evidence: true,
  risks: true,
  actions: true,
});
```

- [ ] **Step 2: Add controls**

Add buttons in header:

```tsx
<button onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))}>75%</button>
<button onClick={() => setZoom(1)}>100%</button>
<button onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.25).toFixed(2))))}>150%</button>
```

Add a compact layer strip below header:

```tsx
<div className="flex flex-wrap gap-2 px-3 pb-3">
  {Object.entries(visibleLayers).map(([layer, enabled]) => (
    <button
      key={layer}
      onClick={() => setVisibleLayers((current) => ({ ...current, [layer]: !enabled }))}
      className={cn(
        "text-[10px] px-2 py-1 rounded-full border capitalize",
        enabled
          ? "text-cyan-300 border-cyan-500/30 bg-cyan-500/10"
          : "text-[#8e8e93] border-[#2a2b30]",
      )}
    >
      {layer}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Apply zoom to preview content**

Wrap preview body content with:

```tsx
<div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
  {/* existing preview content */}
</div>
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run lint
```

Browser acceptance:

```text
Open a Mermaid diagram in canvas
Click 75%, 100%, 150%
Expected: preview scales without layout collapse
Toggle evidence/risk/action layer chips
Expected: chip state changes; no content deletion or regeneration
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Canvas.tsx
git commit -m "feat: add canvas zoom and layer controls"
```

---

## Task 5: Consulting Framework Layer

**Subagent:** Consulting Framework Agent  
**Pattern:** `consulting-structure-layer`  
**Files:**

- Modify: `server.ts`
- Modify: `WidgeTDC_Improvements.md`

- [ ] **Step 1: Ensure Consulting Structure output has framework labels**

In `server.ts`, verify `Consulting Structure` content contains exact labels:

```text
SCR
MECE
Issue Tree
Options
Trade-offs
Recommendation
Evidence Appendix
```

If any label is missing, add it to the deterministic content.

- [ ] **Step 2: Add TODO note**

Append to `WidgeTDC_Improvements.md` under Output Forge Gap-Harvest TODO:

```md
- [ ] **Consulting Framework Layer**
  - Best-practice principle: Consulting outputs must separate storyline, issue structure, options, recommendation and appendix.
  - Expected complaint: "Det er en rapport, men ikke en konsulentleverance."
  - Moat: AI output becomes client-ready decision architecture.
  - Acceptance test: Output can render SCR, MECE, issue tree, options, trade-offs, recommendation and evidence appendix from one request.
```

- [ ] **Step 3: Verify**

Run:

```bash
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add server.ts WidgeTDC_Improvements.md
git commit -m "feat: add consulting framework output layer"
```

---

## Task 6: Trust and Ready-to-Share Language

**Subagent:** Trust/Evidence Agent  
**Pattern:** `trust-ready-to-share-gate`  
**Files:**

- Modify: `server.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Extend status language**

Keep internal status values:

```ts
type OutputForgeStatus = "Draft" | "Grounded" | "Validated" | "Needs review";
```

Add display mapping in `src/App.tsx`:

```ts
const outputStatusLabel: Record<OutputForgeStatus, string> = {
  Draft: "Draft",
  Grounded: "Source-backed",
  Validated: "Ready to share",
  "Needs review": "Check before sharing",
};
```

Render `{outputStatusLabel[outputForgeStatus]}` instead of `{outputForgeStatus}` in Output Forge chips.

- [ ] **Step 2: Add Trust Check route wording**

In `Trust Check` deterministic content, include:

```text
The user does not need to know there is a faithfulness gate. The product value is: trust, source clarity, assumption marking, and share-readiness.
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
```

Browser acceptance:

```text
Click Trust Check
Expected: chip says Check before sharing
Send prompt
Expected: canvas explains Ready to share, Needs source, Assumption, What should I check
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx server.ts
git commit -m "feat: translate trust gate into user-facing language"
```

---

## Task 7: Data Science Reproducibility Layer

**Subagent:** Data Science Agent  
**Pattern:** `data-reproducibility-layer`  
**Files:**

- Modify: `server.ts`
- Modify: `WidgeTDC_Improvements.md`

- [ ] **Step 1: Add reproducibility export placeholders**

In `Reproducibility Pack` content, ensure exact sections:

```text
Dataset snapshot
Transform trace
Metric definitions
Eval metadata
Notebook export
Prompt lineage
Tool route lineage
```

- [ ] **Step 2: Add data-scientist acceptance test to improvements**

Append:

```md
- [ ] **Data Scientist Reproducibility Gate**
  - Best-practice principle: Analytical outputs must be reproducible from source data and transformation trace.
  - Expected complaint: "Kan jeg reproducere denne analyse?"
  - Moat: Each report can become a reproducible analytical package.
  - Acceptance test: Reproducibility Pack includes dataset snapshot, transform trace, metric definitions, eval metadata, notebook export, prompt lineage and tool route lineage.
```

- [ ] **Step 3: Verify**

Run:

```bash
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add server.ts WidgeTDC_Improvements.md
git commit -m "feat: add reproducibility output layer"
```

---

## Task 8: Adoption Flywheel Hook

**Subagent:** Adoption Agent  
**Pattern:** `adoption-flywheel`  
**Files:**

- Modify: `server.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add candidate pattern metadata**

In `buildOutputForgeResponse`, add to `result`:

```ts
adoption_candidate: {
  can_save_pattern: true,
  suggested_pattern_name: `${type} - ${status}`,
  reuse_trigger: "user-approved-output-forge-chain",
}
```

- [ ] **Step 2: Surface adoption next action**

In `src/App.tsx`, when `data.result?.adoption_candidate?.can_save_pattern` is true, append to assistant text:

```ts
assistantText +=
  "\n\n**Next action:** Save this successful chain as a reusable pattern candidate after review.";
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run lint
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
```

Browser acceptance:

```text
Generate Output Forge Gap Report
Expected: assistant response includes "Save this successful chain as a reusable pattern candidate after review."
```

- [ ] **Step 4: Commit**

```bash
git add server.ts src/App.tsx
git commit -m "feat: surface output forge adoption flywheel"
```

---

## Final Verification

- [ ] **Run full static verification**

```bash
npm run lint
npm run build
```

Expected:

```text
tsc --noEmit passes
vite/esbuild build passes
```

Known environment note: If sandboxed `npm run build` fails with `spawn EPERM`, rerun with approved escalation for `npm run build`.

- [ ] **Run API smoke**

```bash
node scripts/smoke/output_forge_gap_smoke.cjs http://127.0.0.1:3022
```

- [ ] **Run browser smoke**

Use Browser or Playwright against `http://127.0.0.1:3022`:

```text
1. Verify first viewport shows ArchitectGPT and Output Forge controls.
2. Verify Plan, Gap Report, Trust Check, Consulting Structure and Reproducibility Pack are visible.
3. Click Gap Report; canvas opens as Draft.
4. Send prompt; canvas shows Gap Report with best-practice method.
5. Click Widen Canvas; canvas grows.
6. Click Focus Canvas; canvas becomes dominant without modal/iframe.
7. Click restore; layout returns without losing content.
8. Verify no visible Gemini text.
```

- [ ] **Final code review**

Dispatch one final code quality reviewer subagent with:

```text
Review Output Forge gap/moat implementation for route shadowing, UI regressions, hardcoded model names, canvas state loss, and user-facing terminology clarity. Do not edit files. Return APPROVED or ISSUES.
```

---

## Stop Conditions

Stop and escalate if:

- Output Forge routes shadow `get_system_health`, `platform.get_dashboard_data`, `flow-develop`, `emit_sonar_pulse`, or `skill-tdd`.
- Canvas resize/focus uses modal, iframe, or new window.
- Any hardcoded runtime model name is introduced.
- A generated artifact loses content when changing canvas size or zoom.
- `npm run lint` fails.
- Smoke test cannot prove the new output types deterministically.

---

## Done Definition

This plan is complete when:

- Output Forge supports `Gap Report`, `Trust Check`, `Consulting Structure`, and `Reproducibility Pack`.
- Canvas can be widened/focused/restored without losing content.
- The UI explains trust as user value: `Source-backed`, `Ready to share`, `Check before sharing`.
- Gap reports use the method: symptom -> best-practice principle -> expected complaint -> moat -> acceptance test.
- Consulting output includes SCR, MECE, issue tree, options, trade-offs, recommendation and evidence appendix.
- Reproducibility output includes dataset, transform, metrics, eval, notebook, prompt and tool lineage placeholders.
- Adoption next action is visible after generated output.
- Lint, build, API smoke and browser smoke pass.
