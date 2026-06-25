/**
 * POST /api/audio-overview — Generate an Audio Overview podcast script.
 *
 * Takes a list of source filenames + optional conversation summary.
 * Calls the LLM to write a 2-host podcast-style digest (NotebookLM style).
 * Returns { script, segments } where segments are { speaker, text } pairs
 * ready to be spoken via Web Speech API on the client.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callMcpTool } from "@/lib/widgetdc.server";

const BodySchema = z.object({
  sources: z.array(z.string()).min(1),
  context: z.string().optional(),
  language: z.enum(["da", "en"]).default("da"),
});

export type AudioSegment = { speaker: "A" | "B"; text: string };
export type AudioOverviewResponse = {
  script: string;
  segments: AudioSegment[];
  duration_estimate_seconds: number;
};

function jsonRes(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PROMPT_DA = (sources: string[], context: string) =>
  `
Du er manuskriptforfatter for et 2-vært podcast-format (som NotebookLM's Audio Overview).
Vært A er entusiastisk og stiller spørgsmål. Vært B er analytisk og forklarer.

EMNE: Indholdet fra disse uploadede dokumenter: ${sources.join(", ")}
${context ? `\nKONTEKST FRA SAMTALE:\n${context}` : ""}

OPGAVE: Skriv et 3-5 minutters podcast-manuskript (ca. 450-700 ord i alt) på DANSK.
- Start med en kort intro der nævner dokumenterne
- Dæk de vigtigste pointer og indsigter
- Slut med 1-2 konkrete takeaways
- Gør det naturligt og konverserende, ikke som en oplæsning

OUTPUT FORMAT (JSON, ingen markdown):
{
  "segments": [
    {"speaker": "A", "text": "..."},
    {"speaker": "B", "text": "..."}
  ]
}
Returnér KUN JSON. Ingen forklaring før eller efter.
`.trim();

const PROMPT_EN = (sources: string[], context: string) =>
  `
You are a scriptwriter for a 2-host podcast (like NotebookLM's Audio Overview).
Host A is enthusiastic and asks questions. Host B is analytical and explains.

TOPIC: Content from these uploaded documents: ${sources.join(", ")}
${context ? `\nCONVERSATION CONTEXT:\n${context}` : ""}

TASK: Write a 3-5 minute podcast script (~450-700 words total) in ENGLISH.
- Start with a brief intro mentioning the documents
- Cover the key points and insights
- End with 1-2 concrete takeaways
- Make it natural and conversational, not a formal reading

OUTPUT FORMAT (JSON, no markdown):
{
  "segments": [
    {"speaker": "A", "text": "..."},
    {"speaker": "B", "text": "..."}
  ]
}
Return ONLY JSON. No explanation before or after.
`.trim();

export const Route = createFileRoute("/api/audio-overview")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonRes({ error: "Expected JSON body" }, 400);
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return jsonRes({ error: parsed.error.message }, 400);
        }

        const { sources, context = "", language } = parsed.data;
        const prompt =
          language === "da" ? PROMPT_DA(sources, context) : PROMPT_EN(sources, context);

        let rawJson: string | null = null;

        // Try llm_chat via orchestrator MCP first (uses platform LLM matrix)
        try {
          const result = await callMcpTool<{ content?: string; text?: string }>("llm_chat", {
            messages: [{ role: "user", content: prompt }],
            model: "gemini-2.5-flash",
            max_tokens: 1500,
            temperature: 0.7,
          });
          rawJson =
            ((result as Record<string, unknown>)?.content as string) ??
            ((result as Record<string, unknown>)?.text as string) ??
            null;
        } catch {
          // fall through to direct Gemini/OpenAI
        }

        // Fallback: direct Gemini call
        if (!rawJson && process.env.GEMINI_API_KEY) {
          try {
            const r = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }],
                  generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
                }),
                signal: AbortSignal.timeout(30_000),
              },
            );
            if (r.ok) {
              const d = (await r.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              };
              rawJson = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
            }
          } catch {
            // fall through
          }
        }

        if (!rawJson) {
          return jsonRes(
            { error: "LLM unavailable — no API key configured or all providers failed" },
            503,
          );
        }

        // Extract JSON from the response (model may wrap it in ```json blocks)
        const jsonMatch = rawJson.match(/\{[\s\S]*"segments"[\s\S]*\}/);
        if (!jsonMatch) {
          return jsonRes(
            { error: "LLM returned unparseable response", raw: rawJson.slice(0, 500) },
            502,
          );
        }

        let parsed2: { segments?: AudioSegment[] };
        try {
          parsed2 = JSON.parse(jsonMatch[0]) as { segments?: AudioSegment[] };
        } catch {
          return jsonRes(
            { error: "Failed to parse LLM JSON", raw: jsonMatch[0].slice(0, 500) },
            502,
          );
        }

        const segments = (parsed2.segments ?? []).filter(
          (s): s is AudioSegment =>
            (s.speaker === "A" || s.speaker === "B") &&
            typeof s.text === "string" &&
            s.text.length > 0,
        );

        if (segments.length === 0) {
          return jsonRes({ error: "No valid segments in LLM response" }, 502);
        }

        const fullScript = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n\n");
        const wordCount = fullScript.split(/\s+/).length;
        const durationEstimate = Math.round((wordCount / 150) * 60); // ~150 wpm

        return jsonRes(
          { script: fullScript, segments, duration_estimate_seconds: durationEstimate },
          200,
        );
      },
    },
  },
});
