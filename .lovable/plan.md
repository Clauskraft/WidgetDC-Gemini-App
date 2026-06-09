## Mål

Bringe `FlowFigure` op på Canvas Flowchart Design System (CFDS) niveau, uden at rive hele app'en op. Vi tager de lag der giver mest visuel og semantisk effekt nu, og lader de tunge ting (React-Flow swap, Neo4j, MCP) ligge til en senere fase.

## Hvad vi laver nu (in-scope)

### 1. Node-taksonomi (CFDS §4)

- Udvider `NodeKind` til de **17 kanoniske typer** + `combo` + `query`:
  `Agent, Artifact, Claim, CodeImplementation, ComplianceGap, Decision, Entity, Evidence, GuardrailRule, Insight, KnowledgePattern, MCPTool, Memory, StrategicInsight, StrategicLeverage, Tool, Track, combo, query`.
- Bevarer de gamle aliasser (`agent`, `tool`, `claim`, `risk`, `gap`, `decision`, `artifact`, `system`, `evidence`) via en `LEGACY_NODE_TYPE_MAP` så eksisterende `flow`-blokke ikke knækker.
- Tilføjer `family` (10 stk: knowledge/evidence/artifact/foundry/reasoning/capability/orchestration/memory/query/meta) som afledt felt.

### 2. Visuel identitet (CFDS §5.1–5.3)

- `NODE_CONFIG` map med hex-farve, lucide-ikon og layer-label per type — eksakte værdier fra spec'en (TDC magenta `#e20074` for Agent osv.).
- Render-varianter implementeret som CSS-klasser på kortet:
  - **BaseNode** (default) — left accent bar 4px i type-farve.
  - **FoundryBlockNode** — 3px double border + lille "FOUNDRY"-pill (StrategicLeverage, KnowledgePattern, GuardrailRule, Decision, ComplianceGap).
  - **ArtifactNode**, **ThoughtNode** (Claim/Memory), **QueryNode**, **ComboNode** — varianter via klassemodifier.
- Overlays:
  - **Provenance badge** (🔍 query, 🤖 ai, 🔗 expand, 🛠 tool, ✋ manual, 🌐 harvest, ⚙ pipeline) i øverste højre hjørne.
  - **Confidence → opacity**: ≥0.9 → 1.0, ≥0.7 → 0.85, ≥0.4 → 0.7 dashed, ellers 0.6 dashed.
  - **Regulatory badge** (`strict #f4bb00`, `guideline #3b82f6`, `info #6b7280`) med alpha-baggrund.
  - **Compliance bar** nederst (≥0.8 grøn / ≥0.5 gul / rød).

### 3. Edge design (CFDS §6)

- Default edge: `strokeWidth 2`, `stroke #334155`, animeret stiplet bevægelse (CSS).
- Label-styling: lille pille med `#0f1d32` baggrund (alpha 0.85), 10px tekst i `#94a3b8`.
- Edge.kind (`CONSTRAINS · IMPLEMENTS · LEVERAGES · RELATED_TO · REMEDIATES · TARGETS`) tilføjet til schema som valgfri — bruges senere til styling per type.

### 4. Layout (CFDS §7) — minimal version

- Beholder den nuværende topologiske layer-tildeling (LR/TD).
- Tilføjer valgfri `lane`-property på noder → snapper til en farvet swimlane-kolonne (subset af `ENGAGEMENT_COLUMNS`, §8). Bruges kun når flow-blokken faktisk sætter `lane`.

### 5. Schema-udvidelser

Backwards-kompatibelt — alt nyt er optional:

```
node: { id, label, kind, summary?, properties?,
        provenance?, confidence?, regulatoryLevel?,
        complianceScore?, lane? }
edge: { from, to, label?, kind? }
spec: { ..., direction, lanes? }
```

## Hvad vi IKKE laver nu (deferred / spørg først)

- Swap fra custom DOM-renderer til `@xyflow/react` (React-Flow).
- Eigenvector-layout (§7.1) og dagre/column-snap engines.
- Intent→standard resolver, 10 visualization families, draw.io/mermaid eksport (§3, §9).
- MCP `canvas_builder` tool, Neo4j persistence, postMessage bridge (§9).

Disse 4 punkter er hver især en større arbejdsstrøm — vi tager dem som separate spor når du beslutter at gå dybere.

## Tekniske detaljer

**Filer der ændres:**

- `src/components/FlowFigure.tsx` — udvidet kind-enum, NODE_CONFIG, render-varianter, overlays, lane-snap, edge.kind.
- `src/styles.css` — nye token-klasser (`.kind-agent` … `.kind-track`), `.foundry-block`, `.provenance-badge`, `.regulatory-strict|guideline|info`, `.compliance-bar`, `.flow-lane-*`.
- `src/lib/figureBlocks.ts` — uændret (samme `flow` fence).

**Tests:** udvider `MessageContent.ssr.test.tsx` med en `flow`-blok der bruger nye felter (provenance, regulatoryLevel, foundry kind) for at sikre SSR + Zod parse stadig holder.

**Risici:**

- Eksisterende flow-blokke i historikken bruger de gamle kinds (`risk`, `gap`, `system`, …) — løses ved alias-map (ingen visuel regression).
- Mange farver/badges på små kort kan virke støjende — vi defaulter til "kun vis hvis feltet er sat", så minimal-blokke ser identiske ud med i dag.

## Spørgsmål inden vi koder

1. Skal vi gå **all-in på React-Flow** (større omskrivning, men matcher CFDS 1:1), eller fortsætte med den nuværende custom-renderer udvidet med CFDS-tokens (denne plan)?
2. Skal `lane`/swimlane være med i første runde, eller vente til vi har et konkret use-case der bruger det?

---

## Validation-driven addendum (2026-06-05)

Efter 10-punkts-validering vs. WidgeTDC Canvas spec — eksekveret som loop med next-best-action:

### ✅ Færdig

1. **Wire-kontrakt: snake_case + ProvenanceData** (`src/components/FlowFigure.tsx`).
   - `parseFlowSpec` normaliserer `node_type`, `node_family`, `regulatory_level`, `compliance_score`, `created_by`, `created_at` → camelCase.
   - `provenance` accepterer både `string` og `{ createdBy, createdAt, source, confidence }`.
2. **subtitle / nodeFamily / modes på NodeCard** (CFDS §4.6).
   - `subtitle` rendres under labelen; `modes` (op til 4) som små uppercase-chips.
3. **Eigenvector centrality layout** (CFDS §7.1).
   - `computeEigenvectorScores` (power-iter 16×, weighted-degree boost 0.05).
   - Bruges til at sortere noder INDEN FOR samme topologiske layer/lane — beholder den eksisterende kolonne-renderer.
4. **Intent → family resolver** (CFDS §2-§3, `src/lib/visualizationIntent.ts`).
   - 10 standards (BPMN/C4/ArchiMate/Sequence/ERD/DFD/State/Capability/ValueStream/DecisionTree).
   - `detectIntent(brief, nodeTypes)` med vægtet keyword-scoring (+2) + node-type bias (+1).
   - `MermaidBlock` viser family-chip ("BPMN · bpmn") + `!mismatch`-warning når LLM'ens mermaid-type ikke matcher intent.

### ⏭ Næste runde (deferred — kræver nye beslutninger)

- **MCP wire-kontrakt** (`@widgetdc/contracts` CanvasIntent/CanvasResolution + `canvas_builder` tool + postMessage bridge).
- **Draw.io dual-render** (eksport af resolveret family til draw.io XML).
- **Swap til `@xyflow/react`** (matcher CFDS 1:1 men er en større omskrivning).
- **Auto-rewrite ved mismatch** (i dag warner vi kun — kan kaldes LLM-roundtrip eller deterministisk mermaid→family transform).

### ✅ Loop 5 — Draw.io dual-render (CFDS §10 compliance)

- `src/lib/mermaidToDrawio.ts` — fuld mermaid `flowchart`/`graph TD|LR` → mxGraph XML konverter.
  - Understøtter rect / rhombus / ellipse / stadium / cylinder shapes.
  - Edge-typer: `-->`, `---`, `-.->`, `==>` + edge labels (`-->|text|`).
  - BFS-baseret layer-tildeling så draw.io kan auto-re-layoute ved åbning.
  - Ikke-flowchart-typer (sequence/er/state/journey/mindmap) eksporteres som placeholder med advarsel — dækker stadig §10 ("dual-render must exist").
- `MermaidBlock` toolbar har ny `.drawio`-knap der downloader filen direkte (`aurora-<family>.drawio`).
- Tests: 4 nye cases i `mermaidToDrawio.test.ts`. Total nu **52 passed**.
