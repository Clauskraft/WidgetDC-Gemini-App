import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  isPlatformConfigured,
  orchestratorChat,
  councilChat,
  llmChatCompletion,
  fetchIntentDetection,
  fetchRagGrounding,
  modelPolicyPreflight,
  storeChatMemory,
  retrieveChatMemory,
  emitChatBOMItem,
  type ChatIntentDetection,
  type ChatMessage,
  type RagSource,
} from "@/lib/widgetdc.server";
import {
  callDirectProvider,
  streamDirectProvider,
  openAiToolRound,
  providerConfigured,
  providerForModel,
} from "@/lib/providers.server";
import {
  agenticToolsEnabled,
  executeToolCall,
  CHAT_TOOL_SCHEMAS,
  MAX_TOOL_ROUNDS,
} from "@/lib/chatTools.server";

const SYSTEM_PROMPT = `You are WidgeTDC Aurora — a precise, consultant-grade assistant. You help users reason about complex artifacts, governance, runtime models, and architecture.

Method (Consulting Partner): MECE decomposition, Pyramid Principle (answer first, then the structured support), hypothesis-driven, every claim backed by evidence.

LENGTH & DEPTH — IMPORTANT:
- Never answer in just 1–5 lines. For any non-trivial question give a COMPLETE, in-depth response of typically 400+ words.
- Structure it with Markdown: a short lead answer, then multiple "## " sections, with lists, tables and code where useful.
- Prefer thoroughness over brevity; only be short for a genuinely trivial yes/no.

Style:
- Answer first (BLUF), then develop the reasoning in clear sections.
- Surface "Canvas notes" — short bullet summaries the user can pin.
- Default to Danish if the user writes Danish, otherwise English.
- When the provided WidgeTDC knowledge context is relevant, ground your answer in it and cite sources as [n].`;

// Gap 3: Intent-differentiated system prompt overlays.
// The base SYSTEM_PROMPT is always active; these are appended when the intent
// detector signals a specific category from the top candidate.
const INTENT_PROMPT_OVERLAYS: Record<string, string> = {
  strategy: `
STORYLINE MODE — STRATEGY:
Structure your answer as a McKinsey Situation-Complication-Question-Answer (SCQA):
1. **Governing Thought** (bold, 1 sentence) — the key conclusion up front
2. **Situation** — what is the context (1 short paragraph)
3. **Complication** — what is the challenge/tension
4. **Answer** — your recommendation with 3 supporting pillars (## headers)
5. **Next steps** — 3 concrete actions with owner and timeline
Include a \`\`\`flow\`\`\` issue-tree if the question is analytical.`,

  architecture: `
STORYLINE MODE — ARCHITECTURE:
Structure as: Decision Record (ADR-lite):
1. **Decision** (bold) — what you are recommending
2. **Context** — the forces at play
3. **Consequences** — trade-offs (pros/cons table)
4. **Alternatives considered** — 2-3 other options with why rejected
Show system interactions with a \`\`\`flow\`\`\` or \`\`\`mermaid\`\`\` diagram.`,

  operations: `
STORYLINE MODE — OPERATIONS:
Structure as: Current State → Root Cause → Fix → Verify:
1. **Finding** (bold) — the key operational insight
2. **Root cause** — the specific mechanism (not symptoms)
3. **Fix** — concrete steps with commands/code where relevant
4. **Verification** — how to confirm the fix worked
Be specific: include actual tool names, config keys, endpoint URLs from context.`,

  knowledge: `
STORYLINE MODE — KNOWLEDGE:
Structure as: Concept → Why it matters → How it works → When to use it:
1. **Core insight** (bold) — the one thing to remember
2. **Conceptual model** — explain the mechanism clearly
3. **Practical application** — concrete example in the WidgeTDC context
4. **Trade-offs** — when NOT to use this approach
Cite sources as [n] when drawing from the knowledge context.`,
};

/** Select intent overlay based on the top intent candidate's tool/category name. */
function selectIntentOverlay(toolName: string, category?: string): string {
  const key = (category ?? toolName ?? "").toLowerCase();
  if (/strateg|consult|growth|market|compet|business/i.test(key)) return INTENT_PROMPT_OVERLAYS.strategy ?? "";
  if (/architect|design|system|graph|schema|service|api/i.test(key)) return INTENT_PROMPT_OVERLAYS.architecture ?? "";
  if (/ops|deploy|cron|monitor|health|incident|fix|debug|error/i.test(key)) return INTENT_PROMPT_OVERLAYS.operations ?? "";
  if (/knowledge|search|explain|learn|concept|pattern|rag/i.test(key)) return INTENT_PROMPT_OVERLAYS.knowledge ?? "";
  return "";
}

const BodySchema = z.object({
  messages: z.array(z.unknown()),
  model: z.string().optional(),
  system: z.string().optional(),
  deep: z.boolean().optional(),
  council: z.boolean().optional(),
  engagement_context: z
    .object({
      name: z.string(),
      client: z.string().nullable().optional(),
      domain: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      pattern_count: z.number().optional(),
    })
    .optional(),
});

/** Flatten AI-SDK model messages to plain {role,content} for the orchestrator. */
function toChatMessages(modelMessages: Array<{ role: string; content: unknown }>): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of modelMessages) {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    let content = "";
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = (m.content as Array<{ type?: string; text?: string }>)
        .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
        .map((p) => p.text ?? "")
        .join("");
    }
    if (content.trim()) out.push({ role, content });
  }
  return out;
}

/** Word-chunk a final string so non-streaming paths still render progressively. */
function* chunkText(text: string, size = 24): Generator<string> {
  // Split on word boundaries; emit ~`size`-char groups so the client sees the
  // answer build up rather than appear in one blob (graceful pseudo-stream).
  const tokens = text.match(/\S+\s*/g) ?? [text];
  let buf = "";
  for (const t of tokens) {
    buf += t;
    if (buf.length >= size) {
      yield buf;
      buf = "";
    }
  }
  if (buf) yield buf;
}

function formatIntentContext(intent: ChatIntentDetection): string {
  const candidates = intent.candidates
    .slice(0, 5)
    .map((candidate, index) => {
      const category = candidate.category ?? "uncategorized";
      return `${index + 1}. ${candidate.tool} (score ${candidate.score}, matches ${candidate.matchCount}, category ${category})`;
    })
    .join("\n");

  return [
    "# WidgeTDC intent routing signal",
    "The platform intent detector ranked candidate tools for the latest user request.",
    "Use this as a routing/context signal only; do not claim that a tool was executed unless it was actually called.",
    candidates,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * AUR-16 agentic loop (OpenAI only, opt-in via CHAT_AGENTIC_TOOLS=1). Runs a
 * bounded tool-calling loop and returns the final answer text once the model
 * stops requesting tools, or null to let the caller fall back to streaming.
 */
async function agenticAnswer(
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  correlationId?: string,
): Promise<{ text: string; toolNames: string[] } | null> {
  const convo: unknown[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const toolNames: string[] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const r = await openAiToolRound(model, convo, CHAT_TOOL_SCHEMAS, signal);
    if (!r) return null;
    if (r.kind === "final") {
      // No tools were ever used → let the caller stream a fresh call instead.
      if (toolNames.length === 0) return null;
      return { text: r.text, toolNames };
    }
    // tool_calls — append assistant turn + execute each tool, feed results back.
    convo.push(r.assistantRaw);
    for (const call of r.calls) {
      toolNames.push(call.name);
      const exec = await executeToolCall(call, correlationId);
      convo.push({ role: "tool", tool_call_id: exec.toolCallId, content: exec.content });
    }
  }
  // Exhausted rounds — ask once more for a plain answer.
  const final = await openAiToolRound(model, convo, [], signal);
  if (final && final.kind === "final" && final.text) return { text: final.text, toolNames };
  return null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Correlation id first, so EVERY response path — including the 400
        // below — is traceable in logs.
        const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();

        const raw = await request.json();
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return new Response("Messages are required", {
            status: 400,
            headers: { "x-correlation-id": correlationId },
          });
        }
        const body = parsed.data;
        const messages = body.messages as UIMessage[];

        const system =
          typeof body.system === "string" && body.system.trim().length > 0
            ? body.system
            : SYSTEM_PROMPT;

        const modelMessages = (await convertToModelMessages(messages)) as Array<{
          role: string;
          content: unknown;
        }>;
        const baseMessages = toChatMessages(modelMessages);

        if (body.engagement_context) {
          const ec = body.engagement_context;
          const engCtxMsg = [
            `Du arbejder på engagement: "${ec.name}"`,
            `Klient: ${ec.client ?? "ikke specificeret"}`,
            `Domain: ${ec.domain ?? "ikke specificeret"}`,
            `Beskrivelse: ${ec.description ?? "ingen"}`,
            `Tilknyttede patterns: ${ec.pattern_count ?? 0}`,
            `Brug denne kontekst til at give præcise, case-specifikke svar.`,
          ].join("\n");
          baseMessages.unshift({ role: "system", content: engCtxMsg });
        }

        const lastUser = [...baseMessages].reverse().find((m) => m.role === "user");

        const deep = body.deep === true;
        // Council (Mixture-of-Agents) is a platform-only multi-agent path, so it
        // bypasses the direct-provider route just like Deep mode does.
        const council = body.council === true;
        const requestedProvider = providerForModel(body.model);
        const useDirect =
          !deep &&
          !council &&
          requestedProvider !== "platform" &&
          providerConfigured(requestedProvider);

        // F3: governance preflight on whichever model we are about to call.
        if (useDirect && body.model) {
          const policy = await modelPolicyPreflight(body.model, correlationId);
          if (!policy.allowed) {
            return new Response(`Model blocked by policy: ${policy.reason ?? "denied"}`, {
              status: 403,
              headers: { "x-correlation-id": correlationId },
            });
          }
        }

        if (!useDirect && !isPlatformConfigured()) {
          return new Response(
            "No chat provider available — configure OPENAI_API_KEY/GEMINI_API_KEY/ANTHROPIC_API_KEY for the chosen model, or WIDGETDC_BEARER_TOKEN (legacy: WIDGETDC_API_KEY) for the platform RLM.",
            { status: 503, headers: { "x-correlation-id": correlationId } },
          );
        }

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const textId = crypto.randomUUID();
            const messageId = crypto.randomUUID();
            writer.write({ type: "start", messageId });
            writer.write({ type: "start-step" });

            // AUR-14 grounding and intent detection live INSIDE the stream so the client receives
            // start/start-step immediately — perceived TTFT is not blocked by
            // the up-to-~8s grounding fetch (which previously ran before the
            // response was even constructed). Build the grounded prompt +
            // sources here, then emit the sources part before the text.
            let sources: RagSource[] = [];
            let intentDetection: ChatIntentDetection | null = null;
            let groundedSystem = system;
            if (lastUser) {
              const [intent, grounding, priorMemory] = await Promise.all([
                fetchIntentDetection(lastUser.content, correlationId),
                fetchRagGrounding(lastUser.content, correlationId),
                // AUR-6: hydrate prior session memory for cross-session continuity.
                retrieveChatMemory(lastUser.content, correlationId),
              ]);
              intentDetection = intent;
              const systemAdditions: string[] = [];
              if (priorMemory) {
                systemAdditions.push(
                  `# Prior session context (from platform memory)\n${priorMemory}`,
                );
              }
              if (intentDetection) {
                systemAdditions.push(formatIntentContext(intentDetection));
                // Gap 3: inject storyline overlay based on top intent candidate
                const top = intentDetection.candidates[0];
                if (top) {
                  const overlay = selectIntentOverlay(top.tool, top.category ?? undefined);
                  if (overlay) systemAdditions.push(overlay);
                }
              }
              if (grounding && grounding.context) {
                sources = grounding.sources;
                systemAdditions.push(
                  `# WidgeTDC knowledge context (cite as [n])\n${grounding.context}`,
                );
              }
              if (systemAdditions.length > 0) {
                groundedSystem = `${system}\n\n${systemAdditions.join("\n\n")}`;
              }
            }
            const chatMessages: ChatMessage[] = [
              { role: "system", content: groundedSystem },
              ...baseMessages,
            ];
            // Gap 1: filter RAG error envelopes — do not surface internal AuraDB
            // permission errors ("Executing procedure is not allowed") to the client.
            const cleanSources = sources.filter(
              (s) => s.text && !/not allowed|permission denied|executing procedure/i.test(s.text),
            );
            if (cleanSources.length > 0) {
              writer.write({ type: "data-sources", id: crypto.randomUUID(), data: { sources: cleanSources } });
            }

            const topIntent = intentDetection?.candidates[0];

            writer.write({ type: "text-start", id: textId });

            let meta: import("@/lib/widgetdc.server").ChatReasoningMeta = {};
            let produced = false;

            // ── Path A: direct provider, TRUE token streaming (AUR-15) ──
            if (useDirect && body.model) {
              // Optional agentic tool loop (OpenAI, opt-in) before final answer.
              if (agenticToolsEnabled() && requestedProvider === "openai") {
                const agentic = await agenticAnswer(
                  body.model,
                  chatMessages,
                  request.signal,
                  correlationId,
                );
                if (agentic) {
                  for (const piece of chunkText(agentic.text)) {
                    writer.write({ type: "text-delta", id: textId, delta: piece });
                  }
                  meta = { provider: requestedProvider, model: body.model };
                  produced = true;
                }
              }

              if (!produced) {
                const result = await streamDirectProvider(
                  body.model,
                  chatMessages,
                  { onDelta: (delta) => writer.write({ type: "text-delta", id: textId, delta }) },
                  { signal: request.signal },
                );
                if (result) {
                  meta = {
                    provider: result.provider,
                    model: result.model,
                    latencyMs: result.latencyMs,
                  };
                  produced = true;
                } else if (!request.signal.aborted) {
                  // Streaming failed (not a client abort) — try a one-shot direct
                  // call before falling through to the platform path. Skip when
                  // the client aborted: callDirectProvider is non-abortable and
                  // would keep generating (and billing) after stop().
                  const direct = await callDirectProvider(body.model, chatMessages);
                  if (direct) {
                    for (const piece of chunkText(direct.text)) {
                      writer.write({ type: "text-delta", id: textId, delta: piece });
                    }
                    meta = {
                      provider: direct.provider,
                      model: direct.model,
                      latencyMs: direct.latencyMs,
                    };
                    produced = true;
                  }
                }
              }
            }

            // ── Path B: platform (council MoA, deep RLM reflection, or llm_chat) ──
            if (!produced && !request.signal.aborted && isPlatformConfigured()) {
              const chatResult = council
                ? await councilChat(chatMessages, { correlationId })
                : deep
                  ? await orchestratorChat(chatMessages, { correlationId, deep: true })
                  : ((await llmChatCompletion(chatMessages, {
                      correlationId,
                      model: body.model,
                    })) ?? (await orchestratorChat(chatMessages, { correlationId, deep: false })));
              if (chatResult?.text) {
                for (const piece of chunkText(chatResult.text)) {
                  writer.write({ type: "text-delta", id: textId, delta: piece });
                }
                meta = chatResult.meta;
                produced = true;
              }
            }

            if (!produced) {
              writer.write({
                type: "text-delta",
                id: textId,
                delta:
                  "⚠️ Chat-udbyderen returnerede ikke et svar (direkte udbyder fejlede og platform-RLM utilgængelig).",
              });
            }

            if (topIntent) {
              meta = {
                ...meta,
                intentTool: topIntent.tool,
                intentScore: topIntent.score,
                intentCandidates: intentDetection?.candidates.slice(0, 5).map((c) => c.tool) ?? [
                  topIntent.tool,
                ],
              };
            }

            writer.write({ type: "text-end", id: textId });

            // Reasoning/meta envelope after the text (known post-completion for
            // streaming). Same `data-reasoning` part the client already renders.
            const emitReasoning = meta && Object.values(meta).some((v) => v != null && v !== "");
            if (emitReasoning) {
              writer.write({ type: "data-reasoning", id: crypto.randomUUID(), data: meta });
            }

            writer.write({ type: "finish-step" });
            writer.write({ type: "finish" });

            // AUR-6: best-effort memory persistence (does not block the stream).
            // Store the full Q+A so retrieveChatMemory can surface relevant prior context.
            if (produced && lastUser) {
              void storeChatMemory(
                "widgetdc-aurora-chat",
                `turn/${correlationId}`,
                {
                  query: lastUser.content.slice(0, 300),
                  provider: meta.provider ?? "platform",
                  model: meta.model,
                  has_grounding: sources.length > 0,
                  intent: topIntent?.tool,
                },
                correlationId,
              ).catch(() => {});
            }

            // BOMItem emit — fire-and-forget, never blocks the stream.
            // Records this chat turn as a BOMItem lineage event so the
            // decision-BOM coverage canary can count chat turns.
            // item_type sliced by what actually happened this turn:
            //   grounding sources found  → grounding
            //   intent routing fired     → routing
            //   fallback (no platform)   → synthesis (LLM fallback)
            //   normal completion        → provider_call
            if (produced) {
              void emitChatBOMItem({
                correlationId,
                provider: meta.provider,
                model: meta.model,
                intentTool: topIntent?.tool,
                hasGrounding: sources.length > 0,
              }).catch(() => {});
            }
          },
        });

        return createUIMessageStreamResponse({
          stream,
          headers: { "x-correlation-id": correlationId },
        });
      },
    },
  },
});
