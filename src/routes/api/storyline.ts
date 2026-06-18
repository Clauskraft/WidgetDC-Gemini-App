/**
 * POST /api/storyline — Storyline Builder (Phase 2, Gamma-pattern).
 *
 * Step 1: generates an outline (slide titles + governing thoughts + key points)
 *         from a brief via the platform LLM proxy.
 * Step 2 (MECE check): POST /api/storyline/mece — verifies MECE quality of
 *         a set of HeadlineSlides via verify_output MCP.
 *
 * Returns: { slides: HeadlineSlide[], correlationId }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callMcpTool, isPlatformConfigured, llmChatCompletion } from "@/lib/widgetdc.server";
import { logServer, summarizeError } from "@/lib/server-logger";

export type HeadlineSlide = {
  title: string;
  governing_thought: string;
  key_points: string[];
};

export type StorylineResponse = {
  slides: HeadlineSlide[];
  correlationId: string;
  degraded?: boolean;
};

export type MeceResponse = {
  passed: boolean;
  issues: string[];
  suggestions: string[];
  correlationId: string;
};

const OutlineBodySchema = z.object({
  brief: z.string().min(10).max(4000),
  kind: z.enum(["analysis", "roadmap", "assessment"]).default("analysis"),
  slide_count: z.number().int().min(3).max(10).default(5),
});

const MeceBodySchema = z.object({
  slides: z.array(
    z.object({
      title: z.string(),
      governing_thought: z.string(),
      key_points: z.array(z.string()),
    }),
  ),
});

function jsonRes(body: unknown, status: number, correlationId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-correlation-id": correlationId },
  });
}

const OUTLINE_SYSTEM = `Du er en McKinsey-niveau konsulent der behersker Pyramid Principle.
Opgave: Generer en præsentationsstruktur (storyline) til en consulting-deliverable.

Regler:
1. BLUF — svar-første struktur. Første slide er executive summary med det mest afgørende fund.
2. Governing thoughts — IKKE emneoverskrifter. "Revenue er faldende" ≠ "Revenue Analysis".
   Skriv handlingsorienterede sætninger der bærer et argument: "Revenue-faldet er channel-drevet, ikke volume-drevet".
3. MECE — slides dækker ikke overlappende emner, og tilsammen dækker de hele problemet.
4. Key points — 3-5 understøttende fakta/argumenter per slide. Kort og præcis.

Output format — EKSAKT JSON array, ingen markdown wrapper:
[
  {
    "title": "kort slide-titel (max 8 ord)",
    "governing_thought": "en handlingsorienteret sætning der bærer argumentet (max 25 ord)",
    "key_points": ["punkt 1", "punkt 2", "punkt 3"]
  }
]`;

async function generateOutlineFallback(
  brief: string,
  kind: string,
  slideCount: number,
): Promise<HeadlineSlide[]> {
  const kindLabel =
    kind === "roadmap" ? "roadmap" : kind === "assessment" ? "assessment" : "analyse";
  return Array.from({ length: slideCount }, (_, i) => ({
    title: i === 0 ? "Executive Summary" : `Slide ${i + 1}`,
    governing_thought: i === 0 ? `Kernefund fra ${kindLabel}: ${brief.slice(0, 60)}…` : "",
    key_points: ["[udfyldes]", "[udfyldes]", "[udfyldes]"],
  }));
}

export const Route = createFileRoute("/api/storyline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
        const url = new URL(request.url);

        // Route: /api/storyline/mece
        if (url.pathname.endsWith("/mece")) {
          let raw: unknown;
          try { raw = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, correlationId); }
          const parsed = MeceBodySchema.safeParse(raw);
          if (!parsed.success) return jsonRes({ error: "Invalid slides payload" }, 422, correlationId);

          const { slides } = parsed.data;
          let result: MeceResponse = { passed: true, issues: [], suggestions: [], correlationId };

          if (isPlatformConfigured()) {
            try {
              const slideText = slides
                .map((s) => `Slide: "${s.governing_thought || s.title}"\nPoints: ${s.key_points.join("; ")}`)
                .join("\n\n");
              const meceResult = await callMcpTool<{ score: number; feedback: string; issues: string[] }>(
                "verify_output",
                {
                  content: slideText,
                  criteria: "MECE check: Er slides Mutually Exclusive (ingen overlap) og Collectively Exhaustive (dækker problemet fuldt ud)? Er governing thoughts argumentbærende (ikke bare emneoverskrifter)?",
                  output_type: "consulting_storyline",
                },
                { timeoutMs: 30000 },
              );
              if (meceResult) {
                const issues = meceResult.issues ?? [];
                const feedbackLines = meceResult.feedback
                  ? meceResult.feedback.split("\n").filter((l) => l.trim().length > 0)
                  : [];
                result = {
                  passed: (meceResult.score ?? 1) >= 0.7 && issues.length === 0,
                  issues,
                  suggestions: feedbackLines.slice(0, 4),
                  correlationId,
                };
              }
            } catch (e) {
              logServer("warn", { event: "mece_check_failed", summary: summarizeError(e) });
            }
          }
          return jsonRes(result, 200, correlationId);
        }

        // Route: /api/storyline (outline generation)
        let raw: unknown;
        try { raw = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400, correlationId); }
        const parsed = OutlineBodySchema.safeParse(raw);
        if (!parsed.success) return jsonRes({ error: "Invalid request", details: parsed.error.flatten() }, 422, correlationId);

        const { brief, kind, slide_count } = parsed.data;
        logServer("info", { event: "storyline_generate_start", correlationId, kind, slide_count });

        try {
          let slides: HeadlineSlide[] = [];

          if (isPlatformConfigured()) {
            const userPrompt = `Brief: ${brief}\nType: ${kind}\nAntal slides: ${slide_count}\n\nGenerer storyline-strukturen. Output KUN JSON array som beskrevet.`;
            const llmResponse = await llmChatCompletion(
              [
                { role: "system", content: OUTLINE_SYSTEM },
                { role: "user", content: userPrompt },
              ],
              { correlationId, maxTokens: 2000 },
            );
            if (llmResponse?.text) {
              try {
                const jsonMatch = /\[[\s\S]*\]/.exec(llmResponse.text);
                if (jsonMatch) {
                  const raw = JSON.parse(jsonMatch[0]) as unknown[];
                  slides = raw
                    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
                    .map((s) => ({
                      title: String(s.title ?? ""),
                      governing_thought: String(s.governing_thought ?? ""),
                      key_points: Array.isArray(s.key_points)
                        ? (s.key_points as unknown[]).map(String)
                        : [],
                    }));
                }
              } catch (parseErr) {
                logServer("warn", { event: "storyline_json_parse_failed", correlationId, summary: summarizeError(parseErr) });
              }
            }
          }

          if (slides.length === 0) {
            slides = await generateOutlineFallback(brief, kind, slide_count);
            logServer("warn", { event: "storyline_fallback", correlationId });
            return jsonRes({ slides, correlationId, degraded: true } satisfies StorylineResponse, 200, correlationId);
          }

          logServer("info", { event: "storyline_generate_success", correlationId, slideCount: slides.length });
          return jsonRes({ slides, correlationId } satisfies StorylineResponse, 200, correlationId);
        } catch (error) {
          logServer("error", { event: "storyline_exception", correlationId, summary: summarizeError(error) }, error);
          return jsonRes({ error: "Storyline generation failed", correlationId }, 500, correlationId);
        }
      },
    },
  },
});
