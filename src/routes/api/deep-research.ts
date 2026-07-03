/**
 * POST /api/deep-research — Multi-step deep research agent (NotebookLM competitor P1).
 *
 * Streams Server-Sent Events to the client:
 *   { event: "plan",     data: { questions: string[] } }
 *   { event: "step",     data: { index: number, question: string, finding: string } }
 *   { event: "report",   data: { markdown: string, sources: string[] } }
 *   { event: "error",    data: { message: string } }
 *
 * Pipeline:
 *   1. PLAN  — LLM decomposes the topic into 3-5 sub-questions
 *   2. RESEARCH — for each sub-question, call search_knowledge MCP + fetchRagGrounding
 *   3. SYNTHESIZE — LLM writes a full structured report citing all evidence
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callMcpTool, fetchRagGrounding } from "@/lib/widgetdc.server";

const BodySchema = z.object({
  topic: z.string().min(3),
  sources: z.array(z.string()).optional(), // ingested filenames to anchor research
  language: z.enum(["da", "en"]).default("da"),
});

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function callGemini(
  prompt: string,
  systemPrompt: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

async function callLlmChat(prompt: string, systemPrompt: string): Promise<string | null> {
  try {
    const result = await callMcpTool<{
      content?: string;
      text?: string;
      choices?: Array<{ message?: { content?: string } }>;
    }>("llm_chat", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      model: "gemini-2.5-flash",
      max_tokens: 4096,
      temperature: 0.3,
    });
    if (!result) return null;
    const r = result as Record<string, unknown>;
    return (
      (r.content as string) ??
      (r.text as string) ??
      (r.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ??
      null
    );
  } catch {
    return null;
  }
}

async function llm(prompt: string, system: string, timeoutMs = 30_000): Promise<string | null> {
  // Try MCP llm_chat first, fall back to direct Gemini
  const via = await callLlmChat(prompt, system);
  if (via) return via;
  return callGemini(prompt, system, timeoutMs);
}

async function searchKnowledge(query: string): Promise<string> {
  try {
    const result = await callMcpTool<{
      results?: Array<{ content?: string; title?: string }>;
      text?: string;
    }>("search_knowledge", { query, limit: 5 });
    if (!result) return "";
    const r = result as Record<string, unknown>;
    if (r.text && typeof r.text === "string") return r.text.slice(0, 2000);
    if (Array.isArray(r.results)) {
      return (r.results as Array<{ content?: string; title?: string }>)
        .map((item) => [item.title, item.content].filter(Boolean).join(": "))
        .join("\n")
        .slice(0, 2000);
    }
    return JSON.stringify(result).slice(0, 2000);
  } catch {
    return "";
  }
}

async function ragSearch(query: string): Promise<{ text: string; sources: string[] }> {
  try {
    const grounding = await fetchRagGrounding(query);
    if (!grounding) return { text: "", sources: [] };
    return {
      text: grounding.context,
      sources: grounding.sources.map((s) => s.source ?? "").filter(Boolean),
    };
  } catch {
    return { text: "", sources: [] };
  }
}

export const Route = createFileRoute("/api/deep-research")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Expected JSON" }), { status: 400 });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
        }

        const { topic, sources = [], language } = parsed.data;
        const isDA = language === "da";
        const allSources = sources.join(", ");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              try {
                controller.enqueue(encoder.encode(sseEvent(event, data)));
              } catch {
                // stream closed
              }
            };

            try {
              // ── Phase 1: PLAN ───────────────────────────────────────────
              const planSystem = isDA
                ? "Du er en forskningsassistent. Returner KUN et JSON-objekt, ingen markdown."
                : "You are a research assistant. Return ONLY a JSON object, no markdown.";
              const planPrompt = isDA
                ? `Emne: "${topic}"${allSources ? `\nKilder: ${allSources}` : ""}

Opdel dette emne i præcis 4 underspørgsmål der tilsammen dækker emnet dybdegående.
Underspørgsmålene skal være konkrete og søgbare.

Returner: {"questions": ["...", "...", "...", "..."]}`
                : `Topic: "${topic}"${allSources ? `\nSources: ${allSources}` : ""}

Decompose this topic into exactly 4 sub-questions that together cover it thoroughly.
Each question should be concrete and searchable.

Return: {"questions": ["...", "...", "...", "..."]}`;

              const planRaw = await llm(planPrompt, planSystem, 20_000);
              const planJson = planRaw?.match(/\{[\s\S]*"questions"[\s\S]*\}/)?.[0];
              let questions: string[] = [];
              try {
                questions = planJson
                  ? ((JSON.parse(planJson) as { questions?: string[] }).questions ?? [])
                  : [];
              } catch {
                // fallback
              }
              if (questions.length === 0) {
                questions = [topic];
              }
              questions = questions.slice(0, 5);
              send("plan", { questions });

              // ── Phase 2: RESEARCH ──────────────────────────────────────
              const findings: Array<{ question: string; evidence: string; sources: string[] }> = [];
              const allKnownSources: string[] = [];

              for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                // Run knowledge search + RAG in parallel
                const [knowledgeText, ragResult] = await Promise.all([
                  searchKnowledge(q),
                  ragSearch(q),
                ]);

                const combined = [
                  knowledgeText ? `[Platform Knowledge]\n${knowledgeText}` : "",
                  ragResult.text ? `[RAG Grounding]\n${ragResult.text}` : "",
                ]
                  .filter(Boolean)
                  .join("\n\n");

                const evidenceSources = ragResult.sources ?? [];
                allKnownSources.push(...evidenceSources);

                // Distill the evidence for this sub-question
                const distillSystem = isDA
                  ? "Du er en analytisk researcher. Vær præcis og faktabaseret."
                  : "You are an analytical researcher. Be precise and fact-based.";
                const distillPrompt = isDA
                  ? `Spørgsmål: ${q}

${combined ? `Relevant information:\n${combined}\n\n` : ""}Opsummér hvad vi ved om dette spørgsmål i 2-4 sætninger. Brug kun information fra kildematerialet. Hvis der er lidt information, angiv det.`
                  : `Question: ${q}

${combined ? `Relevant information:\n${combined}\n\n` : ""}Summarise what we know about this question in 2-4 sentences. Use only information from the source material. If there is little information, say so.`;

                const finding =
                  (await llm(distillPrompt, distillSystem, 20_000)) ??
                  (isDA ? "(Ingen information fundet)" : "(No information found)");
                findings.push({ question: q, evidence: combined, sources: evidenceSources });
                send("step", { index: i, question: q, finding: finding.trim() });
              }

              // ── Phase 3: SYNTHESIZE ────────────────────────────────────
              const evidenceBlock = findings
                .map(
                  (f, i) =>
                    `## Underspørgsmål ${i + 1}: ${f.question}\n${f.evidence || "(ingen data)"}\n`,
                )
                .join("\n");

              const reportSystem = isDA
                ? `Du er en McKinsey-niveau analytiker. Du skriver præcise, velstrukturerede rapporter.
Stil: BLUF (svar først), derefter ## sektioner med data og analyse. Citer som [n].`
                : `You are a McKinsey-level analyst. You write precise, well-structured reports.
Style: BLUF (answer first), then ## sections with data and analysis. Cite as [n].`;

              const reportPrompt = isDA
                ? `Emne: "${topic}"${allSources ? `\nRelevante dokumenter: ${allSources}` : ""}

INDSAMLET EVIDENS:
${evidenceBlock}

Skriv en dybdegående forskningsrapport på DANSK om emnet baseret på evidensen ovenfor.
Strukturér rapporten som:
1. **Governing Thought** — én sætning der opsummerer det vigtigste fund
2. ## Sammenfatning — 2-3 afsnit med de vigtigste indsigter
3. ## [Emne-specifik sektion 1] — dyk ned i første tema
4. ## [Emne-specifik sektion 2] — dyk ned i andet tema
5. ## [Emne-specifik sektion 3] — dyk ned i tredje tema
6. ## Konklusion & anbefalinger — hvad bør man gøre baseret på denne forskning

Brug tabeller og lister hvor det hjælper. Citer data med [n].
Rapporten bør være 600-1000 ord.`
                : `Topic: "${topic}"${allSources ? `\nRelevant documents: ${allSources}` : ""}

COLLECTED EVIDENCE:
${evidenceBlock}

Write an in-depth research report in ENGLISH on the topic based on the evidence above.
Structure as:
1. **Governing Thought** — one sentence summarising the key finding
2. ## Executive Summary — 2-3 paragraphs of key insights
3. ## [Topic-specific section 1] — deep-dive on first theme
4. ## [Topic-specific section 2] — deep-dive on second theme
5. ## [Topic-specific section 3] — deep-dive on third theme
6. ## Conclusions & Recommendations — what to do based on this research

Use tables and lists where helpful. Cite data as [n].
Report should be 600-1000 words.`;

              const report = await llm(reportPrompt, reportSystem, 45_000);
              const uniqueSources = [...new Set(allKnownSources)].filter(Boolean);

              send("report", {
                markdown: report ?? (isDA ? "Rapport ikke tilgængelig." : "Report unavailable."),
                sources: uniqueSources,
              });
            } catch (err) {
              send("error", {
                message:
                  err instanceof Error ? err.message.slice(0, 400) : "Research pipeline failed",
              });
            } finally {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
