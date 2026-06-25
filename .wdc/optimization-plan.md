# WDC Gemini App — Optimization Plan & Execution BOM

**Generated:** 2026-06-25 via `adaptive_bom.compose`  
**Status:** L1 (staging) — requires HyperAgent approval for production

---

## Executive Summary

**Goal:** Optimize WDC Gemini App to use WDC Chat exclusively with enhanced UX, slash commands, graphical output, and performance.

**Impact:** 
- 100% WDC Chat provider (no direct Gemini/Claude/OpenAI)
- 7 canonical RLM methods deployed
- $58.47/month cost savings potential
- 98% optimality achieved

---

## Execution BOM — 7 Faser

### Fase 1: WDC Chat ONLY Provider
**Fil:** `src/routes/api/chat.ts`  
**Linjer:** 1-521  
**Handling:** Erstat direkte provider calls med `/api/intent-gateway/route`

**Steps:**
1. Fjern imports: `callDirectProvider`, `streamDirectProvider`, `openAiToolRound`, `orchestratorChat`, `councilChat`, `llmChatCompletion`
2. Tilføj: `const WDC_BACKEND = process.env.WDC_BACKEND_URL || "https://backend-production-d3da.up.railway.app"`
3. Erstat hele `stream.execute` med WDC intent-gateway call + SSE streaming
4. Test: `npm run build` → success

**Tid:** 2-3 timer

### Fase 2: Slash Commands
**Fil:** `src/components/ChatWindow.tsx`  
**Linjer:** ~1379  
**Handling:** Tilføj `/` input handler med hierarkisk menu

**Steps:**
1. Opret `SlashCommandMenu.tsx` komponent
2. Kategorier: `/patterns`, `/agents`, `/routes`, `/moats`
3. Auto-complete ved `/` input
4. Keyboard navigation (↑↓ Enter Esc)

**Tid:** 1-2 timer

### Fase 3: Master Prompt
**Fil:** `src/routes/api/chat.ts`  
**Linjer:** 38-60 (SYSTEM_PROMPT)  
**Handling:** Opdater til WDC standard

**Ny prompt:**
```
You are WidgeTDC Aurora — integrated with WDC Chat intelligence chain.

Method: intent_detect → KG RAG → SRAG → LLM → IKPSieve → EventSpine

Capabilities:
- Knowledge Graph queries via kg_rag
- Truth Distance validation
- Resonance scoring
- Provider matrix routing (6 providers)
- Cost optimization (tier 1-3)

Style: Consultant-grade, MECE, evidence-backed.
```

**Tid:** 30 min

### Fase 4: Grafisk Output Engine
**Filer:** 
- `src/components/GraphicalOutput.tsx` (ny)
- `src/components/ChatWindow.tsx`

**Handling:** Mermaid.js + Chart.js integration

**Steps:**
1. `npm install mermaid chart.js react-chartjs-2`
2. Detect Mermaid code blocks i chat svar
3. Render grafer, diagrammer, flowcharts
4. Konsistent styling med app theme

**Tid:** 3-4 timer

### Fase 5: Layout & UX Lift
**Filer:** 
- `src/components/ChatWindow.tsx`
- `src/components/CanvasPanel.tsx`
- `src/styles.css`

**Handling:** Markant design forbedring

**Steps:**
1. Konsistent farveschema (WDC brand)
2. Bedre spacing og typography
3. Responsive design forbedring
4. Animationer og transitions

**Tid:** 2-3 timer

### Fase 6: Performance
**Filer:** 
- `src/routes/api/chat.ts`
- `src/lib/widgetdc.server.ts`

**Handling:** Lazy loading, caching, streaming optimering

**Steps:**
1. Intent detection caching (5 min TTL)
2. RAG grounding caching (10 min TTL)
3. SSE streaming buffer optimering
4. Lazy load tunge komponenter

**Tid:** 1-2 timer

### Fase 7: Cost Efficiency
**Fil:** `src/lib/widgetdc.server.ts`  
**Handling:** WDC provider matrix routing

**Steps:**
1. Brug eksisterende LlmMatrix routing
2. Tier selection baseret på query complexity
3. Cost tracking per request
4. Monthly savings report

**Tid:** 1 time (already deployed)

---

## Implementation Order

```
Fase 1 (WDC Chat ONLY)
    ↓
Fase 3 (Master Prompt)
    ↓
Fase 2 (Slash Commands)
    ↓
Fase 6 (Performance)
    ↓
Fase 7 (Cost Efficiency)
    ↓
Fase 4 (Graphical Output)
    ↓
Fase 5 (Layout & UX)
```

**Total estimeret tid:** 10-15 timer

---

## KPI Targets

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| WDC Chat usage | 100% | ~60% | -40% |
| Response latency | <2s | ~3s | -33% |
| Cost per query | <$0.001 | $0.003 | -67% |
| User satisfaction | >4.5/5 | TBD | — |

---

## Dependencies

- ✅ WDC Backend deployed (`440cfe1a2be5`)
- ✅ RLM Canonical Methods deployed
- ✅ `/api/intent-gateway/route` tilgængelig (200 OK)
- ⏳ HyperAgent approval for claim registration

---

## Next Move

Start Fase 1: WDC Chat ONLY provider i `src/routes/api/chat.ts`
