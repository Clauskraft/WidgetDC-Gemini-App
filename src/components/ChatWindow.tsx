import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageContent } from "./MessageContent";
import {
  ArrowUp,
  Sparkles,
  StopCircle,
  PanelRightOpen,
  Copy,
  Check,
  Paperclip,
  X,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Brain,
  Users,
  Briefcase,
  ChevronDown,
  BookmarkPlus,
  Headphones,
  FileSearch,
} from "lucide-react";
import { useThreads } from "@/hooks/useThreads";
import { useCanvas } from "@/lib/canvas-context";
import { shouldAutoOpenCanvas } from "@/lib/canvasTrigger";
import { cn } from "@/lib/utils";
import { validateGemResponse, type ValidationResult } from "@/lib/gemResponseValidator";
import { useModelPreference } from "@/lib/modelPreference";
import type { EngagementRow } from "@/routes/api/engagements";
import { useActiveEngagement } from "@/lib/engagement-context";
import { IngestSourcesPanel, type IngestedSource } from "@/components/IngestSourcesPanel";
import { AudioOverviewPanel } from "@/components/AudioOverviewPanel";
import { DeepResearchPanel } from "@/components/DeepResearchPanel";
import { IntelligenceStrip, type StripReasoning } from "@/components/IntelligenceStrip";
import { emitUiReceipt } from "@/lib/uiReceipts";
import {
  chatRunStatePresentation,
  deriveChatRunState,
  isActiveChatRunState,
  type ChatRunState,
  type ChatRunStatePresentation,
} from "@/lib/chatRunState";

const SUGGESTIONS = [
  {
    title: "Forklar GraphRAG",
    body: "Forklar hvordan GraphRAG med Neo4j fungerer og hvornår det er bedre end vektor-RAG.",
  },
  {
    title: "Resizable canvas plan",
    body: "Foreslå en konkret implementation af resizable workspace med strategic zoom.",
  },
  {
    title: "Agent-arbitrage",
    body: "Skitsér Omega Sentinel multi-agent routing baseret på 10-point analyse.",
  },
  {
    title: "Markdown demo",
    body: "Vis et eksempel-svar med headings, kode, liste og en lille tabel.",
  },
];

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function ChatRunIndicator({
  state,
  presentation,
  compact = false,
}: {
  state: ChatRunState;
  presentation: ChatRunStatePresentation;
  compact?: boolean;
}) {
  const active = isActiveChatRunState(state);
  return (
    <div
      role="status"
      aria-live={active ? "polite" : "off"}
      className={cn(
        "chat-run-indicator",
        `chat-run-indicator--${presentation.tone}`,
        compact && "chat-run-indicator--compact",
      )}
    >
      <span className={cn("chat-run-indicator-dot", active && "chat-run-indicator-dot--active")} />
      <span className="chat-run-indicator-label">{presentation.label}</span>
      {!compact && <span className="chat-run-indicator-detail">{presentation.detail}</span>}
    </div>
  );
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = "image/*,application/pdf,text/plain,text/markdown,application/json,text/csv";

const MAX_HEAL_RETRIES = 2;

type HealAttempt = {
  attempt: number;
  failedMessageId: string;
  issues: ValidationResult["issues"];
  artifactCounts: {
    flowBlocks: number;
    mermaidBlocks: number;
    tables: number;
    canvasNotes: number;
  };
};

type HealSummary = {
  attempts: HealAttempt[];
  finalArtifactCounts: HealAttempt["artifactCounts"];
  resolvedCodes: string[];
};

function countArtifacts(r: ValidationResult): HealAttempt["artifactCounts"] {
  return {
    flowBlocks: r.artifacts.flowBlocks.length,
    mermaidBlocks: r.artifacts.mermaidBlocks.length,
    tables: r.artifacts.tables.length,
    canvasNotes: r.artifacts.canvasNotes.length,
  };
}

function buildHealPrompt(result: ValidationResult, attempt: number): string {
  const lines = result.issues.map((i) => `- [${i.severity.toUpperCase()} ${i.code}] ${i.message}`);
  return [
    `🛠️ Self-heal forsøg ${attempt}/${MAX_HEAL_RETRIES}: dit forrige svar bestod ikke canvas-valideringen.`,
    "",
    "Issues:",
    ...lines,
    "",
    "Producer venligst svaret igen med samme indhold, men ret strukturen så den matcher platformens kontrakt:",
    "- Brug korrekte CFDS node-kinds i ```flow``` blokke (Agent, Artifact, Claim, ComplianceGap, Decision, Entity, Evidence, GuardrailRule, Insight, MCPTool, StrategicInsight, Tool, Track m.fl.).",
    "- Inkluder en `Canvas notes:` sektion med mindst 3 punkter.",
    "- Følg de persona-specifikke krav (issue-tree / threat-model / OPC-UA tabel / OSINT pivot-graf).",
    "Returner kun det rettede svar — ingen meta-kommentarer.",
  ].join("\n");
}

type Attachment = { file: File; dataUrl: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type GemContext = {
  id: string;
  name: string;
  tagline?: string;
  systemPrompt: string;
  accent?: string;
  starters?: { title: string; body: string }[];
};

export function ChatWindow({
  threadId,
  initialMessages,
  initialInput,
  gem,
  onFirstMessage,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialInput?: string;
  gem?: GemContext;
  onFirstMessage?: () => void;
}) {
  const { upsertThread } = useThreads();
  const canvas = useCanvas();
  const [input, setInput] = useState(initialInput ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [ingestedSources, setIngestedSources] = useState<IngestedSource[]>([]);
  const [audioOverviewOpen, setAudioOverviewOpen] = useState(false);
  const [deepResearchOpen, setDeepResearchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const healAttemptsRef = useRef<Map<string, number>>(new Map());
  const healChainRef = useRef(0);
  const engDropdownRef = useRef<HTMLDivElement>(null);
  // Chain-scoped trace of every failed attempt, reset when the chain closes
  // (success or max retries). Used to render the diff on the final message.
  const healChainTraceRef = useRef<HealAttempt[]>([]);
  const [healingMessageId, setHealingMessageId] = useState<string | null>(null);
  const [healHistory, setHealHistory] = useState<Record<string, HealSummary>>({});
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [hasSubmittedPrompt, setHasSubmittedPrompt] = useState(() =>
    initialMessages.some((message) => message.role === "user"),
  );
  const [optimisticSending, setOptimisticSending] = useState(false);
  const [chatError, setChatError] = useState<unknown>(null);
  const [wasCancelled, setWasCancelled] = useState(false);
  // Use global engagement context from __root so context-bar and chat stay in sync
  const { activeEngagement, setActiveEngagement } = useActiveEngagement();
  const [engSelectorOpen, setEngSelectorOpen] = useState(false);

  useEffect(() => {
    fetch("/api/engagements?limit=10")
      .then((r) => r.json())
      .then((data: { engagements?: EngagementRow[] }) => {
        if (Array.isArray(data.engagements)) setEngagements(data.engagements);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!engSelectorOpen) return;
    const handler = (e: MouseEvent) => {
      if (engDropdownRef.current && !engDropdownRef.current.contains(e.target as Node)) {
        setEngSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [engSelectorOpen]);

  const [model] = useModelPreference();
  // AUR-5: "Reason deeply" toggle — persisted across reloads, sent with each
  // request so the server can pass `reflect: true` to the platform RLM.
  // Deep + Council (Mixture-of-Agents) are platform multi-pass paths and are
  // mutually exclusive. Both start false to match SSR, then hydrate from
  // localStorage after mount (avoids hydration mismatch); Council wins if both
  // flags are stored.
  const [deepMode, setDeepMode] = useState(false);
  const [councilMode, setCouncilMode] = useState(false);
  const setFlag = (key: string, on: boolean) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, on ? "1" : "0");
  };
  useEffect(() => {
    if (window.localStorage.getItem("widgetdc.chat.council") === "1") setCouncilMode(true);
    else if (window.localStorage.getItem("widgetdc.chat.deep") === "1") setDeepMode(true);
  }, []);
  const toggleDeep = useCallback(() => {
    setDeepMode((prev) => {
      const next = !prev;
      setFlag("widgetdc.chat.deep", next);
      if (next) {
        setCouncilMode(false);
        setFlag("widgetdc.chat.council", false);
      }
      return next;
    });
  }, []);
  const toggleCouncil = useCallback(() => {
    setCouncilMode((prev) => {
      const next = !prev;
      setFlag("widgetdc.chat.council", next);
      if (next) {
        setDeepMode(false);
        setFlag("widgetdc.chat.deep", false);
      }
      return next;
    });
  }, []);
  // Per-request body (model / deep / council / persona) is read at SEND time via
  // a ref so the latest selection always reaches the request. The transport is
  // stable on purpose: useChat binds it once at init, so recreating it when
  // `model` changes does NOT take effect — that was the bug where the picker
  // selection was ignored and the server always received the initial model.
  const requestMetaRef = useRef({
    model,
    deep: deepMode,
    council: councilMode,
    system: gem?.systemPrompt,
    activeEngagement,
  });
  requestMetaRef.current = {
    model,
    deep: deepMode,
    council: councilMode,
    system: gem?.systemPrompt,
    activeEngagement,
  };
  const buildRequestBody = useCallback(() => {
    const { model: m, deep, council, system, activeEngagement: eng } = requestMetaRef.current;
    return {
      model: m,
      deep,
      council,
      ...(system ? { system } : {}),
      ...(eng
        ? {
            engagement_context: {
              id: eng.id,
              name: eng.name,
              client: eng.client,
              domain: eng.domain,
              description: eng.description,
              pattern_count: eng.pattern_count,
            },
          }
        : {}),
    };
  }, []);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => {
      console.error("Chat error:", e);
      setChatError(e);
      setOptimisticSending(false);
    },
  });

  const [sessionSearch, setSessionSearch] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const currentAssistantTextLength = useMemo(() => {
    const last = messages[messages.length - 1];
    return isLoading && last?.role === "assistant" ? getText(last).trim().length : 0;
  }, [isLoading, messages]);
  const chatRunState = deriveChatRunState({
    transportStatus: status,
    hasSubmittedPrompt,
    assistantTextLength: currentAssistantTextLength,
    isSending: optimisticSending,
    isToolWorking: healingMessageId !== null,
    wasCancelled,
    error: chatError,
  });
  const chatRunPresentation = chatRunStatePresentation(
    chatRunState,
    healingMessageId
      ? `Self-heal forsøg ${healAttemptsRef.current.get(healingMessageId) ?? 1}/${MAX_HEAL_RETRIES} retter canvas-struktur.`
      : undefined,
  );
  const showInlineRunState =
    isActiveChatRunState(chatRunState) ||
    chatRunState === "errored" ||
    chatRunState === "cancelled";

  // GF-PR2: the IntelligenceStrip is the ONE run-status surface. It reads the
  // latest assistant message's enrichment parts (data-reasoning/data-sources,
  // emitted by /api/chat since GF-PR2) and stays visible after completion so
  // the routing evidence for the last answer remains one glance away.
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const stripReasoning = useMemo(() => {
    const part = (
      latestAssistant?.parts as Array<{ type?: string; data?: unknown }> | undefined
    )?.find((p) => p && p.type === "data-reasoning");
    return (part?.data ?? null) as StripReasoning | null;
  }, [latestAssistant]);
  const stripSourceCount = useMemo(() => {
    const part = (
      latestAssistant?.parts as Array<{ type?: string; data?: unknown }> | undefined
    )?.find((p) => p && p.type === "data-sources");
    return ((part?.data as { sources?: unknown[] } | undefined)?.sources ?? []).length;
  }, [latestAssistant]);
  // GF-PR3: the chat feeds the route-agnostic canvas (P2 — the answer's
  // shadow). Messages are published to the provider; auto-open fires ONCE on
  // the active→completed transition when the latest answer carries structure,
  // on md+ viewports, unless the user closed the canvas earlier in this thread.
  const latestAssistantText = latestAssistant ? getText(latestAssistant) : "";
  const canvasWorthy = useMemo(
    () => Boolean(latestAssistantText) && shouldAutoOpenCanvas(latestAssistantText),
    [latestAssistantText],
  );
  // A structured answer keeps the strip up after completion to advertise
  // "canvas ready", even when the run carried no enrichment parts.
  const showIntelligenceStrip =
    showInlineRunState || stripReasoning !== null || stripSourceCount > 0 || canvasWorthy;
  useEffect(() => {
    canvas.publishMessages(threadId, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publishMessages is stable
  }, [threadId, messages]);
  // Auto-open keys on NEW assistant message ids relative to a mount baseline,
  // not on observing an "active" render: an atomically-delivered stream can
  // settle inside one React commit, so idle->completed may be the only visible
  // transition. Baseline = latest assistant at mount, which also means a
  // reload of a persisted thread never auto-opens (the canvas is the shadow
  // of NEW answers, not of history).
  const autoOpenBaselineRef = useRef<string | null | undefined>(undefined);
  const lastAutoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoOpenBaselineRef.current === undefined) {
      autoOpenBaselineRef.current = latestAssistant?.id ?? null;
      return;
    }
    if (chatRunState !== "completed" || !canvasWorthy || canvas.userClosedThisThread) return;
    const id = latestAssistant?.id;
    if (!id || id === autoOpenBaselineRef.current || id === lastAutoOpenedRef.current) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    lastAutoOpenedRef.current = id;
    canvas.openCanvas(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on run state + latest answer
  }, [chatRunState, latestAssistant?.id, canvasWorthy]);

  useEffect(() => {
    if (status !== "ready" || messages.length > 0) setOptimisticSending(false);
  }, [messages.length, status]);

  // Persist messages continuously; fire onFirstMessage exactly once — but
  // ONLY after the first run has finished streaming. The parent's
  // history.replaceState triggers a router remount in this TanStack version
  // (the old "updates in place, does NOT unmount us" assumption was wrong),
  // which aborted the in-flight useChat stream: the user saw their prompt but
  // the answer silently vanished. Deferring the URL update to run-completion
  // means the remount replays the already-persisted messages losslessly.
  const firedFirstRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? getText(firstUser).slice(0, 60) || "Ny samtale" : "Ny samtale";
    upsertThread(threadId, { title, messages });
    const streamSettled = status !== "streaming" && status !== "submitted";
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (firstUser && hasAssistant && streamSettled && !firedFirstRef.current) {
      firedFirstRef.current = true;
      onFirstMessage?.();
    }
  }, [messages, threadId, upsertThread, onFirstMessage, status]);

  // Safety net: if navigation hasn't unmounted us within ~4s, clear the
  // overlay so the user isn't stuck on a loading state.
  useEffect(() => {
    if (!isCreatingThread) return;
    const t = setTimeout(() => setIsCreatingThread(false), 4000);
    return () => clearTimeout(t);
  }, [isCreatingThread]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, status]);

  // Self-heal: when an assistant message finishes streaming and fails
  // canvas-validation, ask the gem to repair its own output up to MAX_HEAL_RETRIES.
  useEffect(() => {
    if (!gem) return;
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const text = getText(last);
    if (!text.trim()) return;
    if (healAttemptsRef.current.has(last.id)) return; // already evaluated
    const result = validateGemResponse(text, gem.id);
    if (result.ok) {
      // Chain closed successfully — if there were prior failed attempts,
      // emit a diff summary on this final, validated message.
      if (healChainTraceRef.current.length > 0) {
        const trace = healChainTraceRef.current;
        const originalCodes = new Set(trace[0].issues.map((i) => i.code));
        setHealHistory((prev) => ({
          ...prev,
          [last.id]: {
            attempts: trace,
            finalArtifactCounts: countArtifacts(result),
            resolvedCodes: Array.from(originalCodes),
          },
        }));
      }
      healChainTraceRef.current = [];
      healChainRef.current = 0;
      setHealingMessageId(null);
      healAttemptsRef.current.set(last.id, 0);
      return;
    }
    if (healChainRef.current >= MAX_HEAL_RETRIES) {
      // Exhausted — still surface the trace on the last (still-failing) message.
      if (healChainTraceRef.current.length > 0) {
        const trace = [
          ...healChainTraceRef.current,
          {
            attempt: healChainRef.current + 1,
            failedMessageId: last.id,
            issues: result.issues,
            artifactCounts: countArtifacts(result),
          },
        ];
        setHealHistory((prev) => ({
          ...prev,
          [last.id]: {
            attempts: trace,
            finalArtifactCounts: countArtifacts(result),
            resolvedCodes: [],
          },
        }));
      }
      healChainTraceRef.current = [];
      setHealingMessageId(null);
      healAttemptsRef.current.set(last.id, healChainRef.current);
      return;
    }
    healChainRef.current += 1;
    healChainTraceRef.current.push({
      attempt: healChainRef.current,
      failedMessageId: last.id,
      issues: result.issues,
      artifactCounts: countArtifacts(result),
    });
    healAttemptsRef.current.set(last.id, healChainRef.current);
    setHealingMessageId(last.id);
    void sendMessage(
      { text: buildHealPrompt(result, healChainRef.current) },
      { body: buildRequestBody() },
    );
  }, [status, messages, gem, sendMessage, buildRequestBody]);

  const submit = async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && attachments.length === 0) || isLoading) return;
    const files = attachments;
    setInput("");
    setAttachments([]);
    // New user turn → reset self-heal chain.
    healChainRef.current = 0;
    healChainTraceRef.current = [];
    setHealingMessageId(null);
    setHasSubmittedPrompt(true);
    setOptimisticSending(true);
    setChatError(null);
    setWasCancelled(false);
    const fileParts = files.map((a) => ({
      type: "file" as const,
      mediaType: a.file.type || "application/octet-stream",
      filename: a.file.name,
      url: a.dataUrl,
    }));
    try {
      if (fileParts.length > 0) {
        await sendMessage(
          {
            role: "user",
            parts: [...fileParts, ...(content ? [{ type: "text" as const, text: content }] : [])],
          },
          { body: buildRequestBody() },
        );
      } else {
        await sendMessage({ text: content }, { body: buildRequestBody() });
      }
    } catch (err) {
      console.error("Chat send failed:", err);
      setChatError(err);
    } finally {
      setOptimisticSending(false);
    }
  };

  const stopChat = () => {
    setWasCancelled(true);
    setOptimisticSending(false);
    stop();
  };

  const INGEST_TYPES = new Set([
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
  ]);

  const isIngestable = (file: File) =>
    INGEST_TYPES.has(file.type) ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.toLowerCase().endsWith(".pdf");

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const nextAttachments: Attachment[] = [];
    const toIngest: File[] = [];

    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        console.warn(`Skipper ${file.name}: over 8 MB`);
        continue;
      }
      if (file.type.startsWith("image/")) {
        // Images stay as LLM vision parts
        try {
          const dataUrl = await fileToDataUrl(file);
          nextAttachments.push({ file, dataUrl });
        } catch (err) {
          console.error("Kunne ikke læse fil:", err);
        }
      } else if (isIngestable(file)) {
        // Documents go to persistent RAG ingest
        toIngest.push(file);
      } else {
        // Fallback: treat as vision attachment
        try {
          const dataUrl = await fileToDataUrl(file);
          nextAttachments.push({ file, dataUrl });
        } catch (err) {
          console.error("Kunne ikke læse fil:", err);
        }
      }
    }

    if (nextAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...nextAttachments]);
    }

    if (toIngest.length > 0) {
      // Add as pending immediately so the user sees feedback
      const pending: IngestedSource[] = toIngest.map((f) => ({
        id: f.name,
        filename: f.name,
        status: "pending" as const,
      }));
      setIngestedSources((prev) => [...prev, ...pending]);

      // Fire ingest requests in background
      const form = new FormData();
      toIngest.forEach((f) => form.append("file", f));
      fetch("/api/ingest", { method: "POST", body: form })
        .then((r) => r.json())
        .then(
          (data: {
            results?: Array<{
              id: string;
              filename: string;
              status: "ok" | "error";
              error?: string;
            }>;
          }) => {
            if (!data.results) return;
            setIngestedSources((prev) =>
              prev.map((src) => {
                const result = data.results!.find((r) => r.filename === src.filename);
                if (!result) return src;
                return {
                  id: result.id || src.filename,
                  filename: src.filename,
                  status: result.status,
                  error: result.error,
                };
              }),
            );
          },
        )
        .catch((err) => {
          console.error("Ingest fejlede:", err);
          setIngestedSources((prev) =>
            prev.map((src) =>
              toIngest.some((f) => f.name === src.filename)
                ? { ...src, status: "error" as const, error: "Netværksfejl" }
                : src,
            ),
          );
        });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeIngestedSource = (id: string) => {
    setIngestedSources((prev) => prev.filter((s) => s.id !== id && s.filename !== id));
  };

  const empty = messages.length === 0;
  const emptyStarters = gem?.starters ?? SUGGESTIONS;
  const emptyGreeting = gem ? gem.name : "Hej. Hvad arbejder vi på i dag?";
  const emptyTagline = gem?.tagline ?? "WidgeTDC Aurora — drevet af WidgeTDC-platformen.";
  const composerPlaceholder = "Skriv din besked til Aurora...";

  return (
    <div className="relative flex h-screen flex-1">
      {isCreatingThread && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/90 px-6 py-5 shadow-lg">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="text-sm font-medium text-foreground">Opretter tråd…</div>
            <div className="text-xs text-muted-foreground">Et øjeblik mens vi åbner samtalen</div>
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border/40 bg-background/90 px-5 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {gem ? (
              <div
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-br",
                  gem.accent ?? "from-primary to-primary",
                )}
              >
                {gem.name}
              </div>
            ) : (
              <span className="text-[13px] font-medium text-muted-foreground/70">Aurora</span>
            )}
            {activeEngagement && (
              <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-2.5 py-1 text-xs text-primary">
                <Briefcase className="h-3 w-3 flex-none" />
                <span className="max-w-[14rem] truncate font-medium">{activeEngagement.name}</span>
                <button
                  onClick={() => setActiveEngagement(null)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-primary/60 transition hover:bg-primary/15 hover:text-primary"
                  aria-label="Fjern engagement-kontekst"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {engagements.length > 0 && (
              <div className="relative" ref={engDropdownRef}>
                <button
                  onClick={() => setEngSelectorOpen((v) => !v)}
                  aria-expanded={engSelectorOpen}
                  title="Vælg engagement-kontekst"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-accent",
                    activeEngagement && "border-primary/40 bg-primary/8 text-primary",
                  )}
                >
                  <Briefcase className="h-4 w-4" />
                  Kontekst
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform", engSelectorOpen && "rotate-180")}
                  />
                </button>
                {engSelectorOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-border bg-card shadow-lg">
                    <div className="border-b border-border/60 px-4 py-2.5">
                      <p className="text-xs font-medium text-foreground">Engagement-kontekst</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        AI'en kender casen og giver case-specifikke svar.
                      </p>
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-1.5">
                      {engagements.map((eng) => (
                        <li key={eng.id}>
                          <button
                            onClick={() => {
                              setActiveEngagement(activeEngagement?.id === eng.id ? null : eng);
                              setEngSelectorOpen(false);
                            }}
                            className={cn(
                              "flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition hover:bg-accent",
                              activeEngagement?.id === eng.id && "bg-primary/8",
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {eng.name}
                              </span>
                              {activeEngagement?.id === eng.id && (
                                <Check className="h-3.5 w-3.5 flex-none text-primary" />
                              )}
                            </span>
                            {(eng.client ?? eng.domain) && (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {[eng.client, eng.domain].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {activeEngagement && (
                      <div className="border-t border-border/60 px-4 py-2">
                        <button
                          onClick={() => {
                            setActiveEngagement(null);
                            setEngSelectorOpen(false);
                          }}
                          className="text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          Fjern kontekst
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* WDC Chat ONLY — no model picker */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-soft"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="truncate max-w-[180px]">WDC Chat</span>
            </button>
            <ChatRunIndicator state={chatRunState} presentation={chatRunPresentation} compact />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                toggleDeep();
              }}
              aria-pressed={deepMode}
              title="Reason deeply — RLM reflektion + reasoning chain"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium transition-all duration-150 hover:bg-accent hover:border-border",
                deepMode ? "bg-primary/10 text-primary border-primary/40" : "text-muted-foreground",
              )}
            >
              <Brain className="h-3.5 w-3.5" />
              Deep
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                toggleCouncil();
              }}
              aria-pressed={councilMode}
              title="Council — Mixture-of-Agents: flere specialist-agenter + konsensus"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium transition-all duration-150 hover:bg-accent hover:border-border",
                councilMode
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "text-muted-foreground",
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Council
            </button>
            <button
              onClick={() => (canvas.open ? canvas.closeCanvas(true) : canvas.openCanvas())}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium transition-all duration-150 hover:bg-accent hover:border-border",
                canvas.open ? "bg-accent text-foreground border-border" : "text-muted-foreground",
              )}
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              Canvas
            </button>
            {ingestedSources.length > 0 && (
              <button
                onClick={() => setAudioOverviewOpen((v) => !v)}
                aria-pressed={audioOverviewOpen}
                title="Audio Overview — lyt til en podcast-sammenfatning af dine dokumenter"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium transition-all duration-150 hover:bg-accent hover:border-border",
                  audioOverviewOpen
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "text-muted-foreground",
                )}
              >
                <Headphones className="h-3.5 w-3.5" />
                Audio
              </button>
            )}
            <button
              onClick={() => setDeepResearchOpen((v) => !v)}
              aria-pressed={deepResearchOpen}
              title="Deep Research — autonomt multi-step forskningsagent"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-[13px] font-medium transition-all duration-150 hover:bg-accent hover:border-border",
                deepResearchOpen
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "text-muted-foreground",
              )}
            >
              <FileSearch className="h-3.5 w-3.5" />
              Research
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="mx-auto flex h-full w-full min-w-0 max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
              <div
                className={cn(
                  "mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-3xl shadow-glow",
                  gem?.accent ? `bg-gradient-to-br ${gem.accent}` : "bg-gradient-aurora",
                )}
              >
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h1
                className={cn(
                  "max-w-full text-balance bg-clip-text text-[1.8rem] font-semibold leading-tight tracking-tight text-transparent sm:text-[2.2rem]",
                  gem?.accent ? `bg-gradient-to-br ${gem.accent}` : "bg-gradient-aurora",
                )}
              >
                {emptyGreeting}
              </h1>
              <p className="mt-2.5 text-[15px] text-muted-foreground">{emptyTagline}</p>
              <div className="mt-8 grid w-full grid-cols-1 gap-2.5 md:grid-cols-2">
                {emptyStarters.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => submit(s.body)}
                    className="group rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition-all duration-150 hover:border-primary/30 hover:bg-card hover:shadow-soft active:scale-[0.99]"
                  >
                    <div className="text-sm font-semibold text-foreground">{s.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                      {s.body}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1 && isLoading;
                return (
                  <Message
                    key={m.id}
                    message={m}
                    gemId={gem?.id}
                    skipValidation={isLastAssistant}
                    healSummary={healHistory[m.id]}
                  />
                );
              })}
              {showIntelligenceStrip && (
                <IntelligenceStrip
                  state={chatRunState}
                  presentation={chatRunPresentation}
                  reasoning={stripReasoning}
                  sourceCount={stripSourceCount}
                  canvasReady={canvasWorthy}
                  onExpand={() => {
                    // GF-PR4: a user pulling the routing detail open is real
                    // feedback that the routed tool's evidence was worth a look.
                    if (stripReasoning?.intentTool) {
                      emitUiReceipt({
                        interaction: "fold_out",
                        entity_id: `strip/${threadId}`,
                        producing_tool: stripReasoning.intentTool,
                        session_id: threadId,
                      });
                    }
                  }}
                  action={
                    canvasWorthy && !canvas.open
                      ? {
                          label: "Open canvas",
                          onClick: () => {
                            // User-initiated fold-out (auto-open deliberately
                            // does NOT emit — crediting it would be pre-payment).
                            if (stripReasoning?.intentTool) {
                              emitUiReceipt({
                                interaction: "fold_out",
                                entity_id: `canvas/${threadId}`,
                                producing_tool: stripReasoning.intentTool,
                                session_id: threadId,
                              });
                            }
                            canvas.openCanvas(latestAssistant?.id);
                          },
                        }
                      : null
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="border-t border-border/60 bg-background/80 px-6 py-4 backdrop-blur"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            onPickFiles(e.dataTransfer.files);
          }}
        >
          <div className="mx-auto max-w-3xl">
            <IngestSourcesPanel
              sources={ingestedSources}
              onRemove={removeIngestedSource}
              onDropFiles={(files) => onPickFiles(files)}
              className="mb-2"
            />
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => {
                  const isImage = a.file.type.startsWith("image/");
                  return (
                    <div
                      key={i}
                      className="group relative flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 text-xs"
                    >
                      {isImage ? (
                        <div
                          className="aurora-thumb h-12 w-12 cursor-pointer transition group-hover:ring-1 group-hover:ring-primary/40"
                          onClick={() => setPreviewAttachment(a)}
                          role="button"
                          title="Klik for forstørrelse"
                        >
                          <img src={a.dataUrl} alt={a.file.name} />
                        </div>
                      ) : (
                        <div className="aurora-thumb h-12 w-12">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="max-w-[160px]">
                        <div className="truncate font-medium">{a.file.name}</div>
                        <div className="text-muted-foreground">
                          {(a.file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Fjern"
                        title="Fjern vedhæftning"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-soft transition focus-within:border-primary/50 focus-within:shadow-glow">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                hidden
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent"
                aria-label="Vedhæft fil"
                title="Vedhæft billede eller fil"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length > 0) {
                    e.preventDefault();
                    const dt = new DataTransfer();
                    files.forEach((f) => dt.items.add(f));
                    onPickFiles(dt.files);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={composerPlaceholder}
                rows={1}
                className="max-h-48 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                style={{ minHeight: "2.5rem" }}
              />
              {isLoading ? (
                <button
                  onClick={stopChat}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90"
                  aria-label="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => submit()}
                  disabled={
                    !input.trim() && attachments.length === 0 && ingestedSources.length === 0
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-aurora text-white shadow-glow transition disabled:opacity-40 disabled:shadow-none"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
              Aurora kan tage fejl — verificer vigtige svar.
            </p>
          </div>
        </div>
      </div>

      {audioOverviewOpen && ingestedSources.length > 0 && (
        <div className="absolute bottom-24 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)]">
          <AudioOverviewPanel
            sources={ingestedSources}
            onClose={() => setAudioOverviewOpen(false)}
          />
        </div>
      )}

      {deepResearchOpen && (
        <div className="w-[400px] flex-none border-l border-border/40 bg-background overflow-hidden flex flex-col">
          <DeepResearchPanel
            sources={ingestedSources}
            onClose={() => setDeepResearchOpen(false)}
            onInsertReport={(md) => {
              setInput((prev) => (prev ? prev + "\n\n" + md : md));
              setDeepResearchOpen(false);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}

      {/* Image preview modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewAttachment(null)}
        >
          <div className="relative max-h-[85vh] max-w-[90vw] rounded-2xl border border-border bg-background p-3 shadow-2xl">
            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.file.name}
              className="max-h-[80vh] max-w-[85vw] rounded-xl object-contain"
            />
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-sm font-medium text-foreground">
                {previewAttachment.file.name}
              </span>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Luk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({
  message,
  gemId,
  skipValidation,
  healSummary,
}: {
  message: UIMessage;
  gemId?: string;
  skipValidation?: boolean;
  healSummary?: HealSummary;
}) {
  const text = getText(message);
  const [copied, setCopied] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const fileParts = message.parts.filter((p) => p.type === "file") as Array<{
    type: "file";
    mediaType: string;
    url: string;
    filename?: string;
  }>;

  // AUR-14: pick up the data-sources part (NEXUS/SRAG grounding) so the [n]
  // citations the server injected are actually visible to the user.
  const sourcesPart = (message.parts as Array<{ type?: string; data?: unknown }>).find(
    (p) => p && p.type === "data-sources",
  );
  const sources = (sourcesPart?.data as { sources?: ChatSource[] } | undefined)?.sources ?? [];

  const validation = useMemo<ValidationResult | null>(() => {
    if (skipValidation) return null;
    if (message.role !== "assistant") return null;
    if (!text.trim()) return null;
    // Use "default" McKinsey storyline rules when no gem is active
    return validateGemResponse(text, gemId ?? "default");
  }, [text, gemId, message.role, skipValidation]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2">
          {fileParts.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {fileParts.map((p, i) =>
                p.mediaType?.startsWith("image/") ? (
                  <figure key={i} className="aurora-figure max-w-xs">
                    <img src={p.url} alt={p.filename ?? "vedhæftning"} />
                    {p.filename && <figcaption>{p.filename}</figcaption>}
                  </figure>
                ) : (
                  <a
                    key={i}
                    href={p.url}
                    download={p.filename}
                    className="inline-flex items-center gap-2 rounded-xl border border-figure-border bg-figure-surface px-3 py-2 text-xs text-foreground shadow-soft hover:bg-accent"
                  >
                    <FileText className="h-4 w-4" />
                    {p.filename ?? "fil"}
                  </a>
                ),
              )}
            </div>
          )}
          {text && (
            <div className="rounded-3xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground">
              <div className="whitespace-pre-wrap text-sm">{text}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-aurora shadow-glow">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <MessageContent
          text={text}
          onCitationClick={sources.length > 0 ? (n) => setActiveCitation(n) : undefined}
        />
        {sources.length > 0 && (
          <SourcesPanel
            sources={sources}
            activeCitation={activeCitation}
            onCitationClick={setActiveCitation}
          />
        )}
        {/* GF-PR2: routing/intent detail now lives in the IntelligenceStrip
            (one calm surface, P1); per-message ReasoningPanel retired. */}
        {healSummary && <HealDiffPanel summary={healSummary} />}
        {validation && <ValidationBadge result={validation} />}
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition hover:bg-accent group-hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Kopieret" : "Kopiér"}
        </button>
      </div>
    </div>
  );
}

// AUR-14: client-side mirror of the server's RagSource shape (data-sources part).
type ChatSource = { text: string; source?: string; score?: number };

function SourcesPanel({
  sources,
  activeCitation,
  onCitationClick,
}: {
  sources: ChatSource[];
  activeCitation?: number | null;
  onCitationClick?: (n: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<Record<number, "idle" | "loading" | "done">>({});
  const { activeEngagement } = useActiveEngagement();
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (activeCitation != null) {
      setOpen(true);
      const el = itemRefs.current[activeCitation - 1];
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeCitation]);

  async function pinSource(i: number, s: ChatSource) {
    if (!activeEngagement || pinned[i] === "loading" || pinned[i] === "done") return;
    setPinned((p) => ({ ...p, [i]: "loading" }));
    try {
      const res = await fetch(`/api/engagements/${activeEngagement.id}/sources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: s.text, source_label: s.source }),
      });
      if (res.ok) {
        setPinned((p) => ({ ...p, [i]: "done" }));
        setTimeout(() => setPinned((p) => ({ ...p, [i]: "idle" })), 3500);
      } else {
        setPinned((p) => ({ ...p, [i]: "idle" }));
      }
    } catch {
      setPinned((p) => ({ ...p, [i]: "idle" }));
    }
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-3 rounded-2xl border border-figure-border bg-figure-surface/40 px-4 py-3 text-xs"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 text-foreground">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Kilder</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          {sources.length}
        </span>
      </summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
        {sources.map((s, i) => {
          const isActive = activeCitation === i + 1;
          return (
            <li
              key={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={cn(
                "group/src flex items-start gap-2 leading-snug rounded px-1 -mx-1 transition-colors",
                isActive && "bg-primary/8 text-foreground",
              )}
            >
              <span className="flex-1">
                {s.source && <span className="font-medium text-foreground">{s.source}: </span>}
                {s.text}
              </span>
              {activeEngagement && (
                <button
                  type="button"
                  title="Gem til engagement"
                  onClick={() => pinSource(i, s)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover/src:opacity-100"
                >
                  {pinned[i] === "done" ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <BookmarkPlus className="h-3 w-3" />
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function ValidationBadge({ result }: { result: ValidationResult }) {
  const [open, setOpen] = useState(false);
  const errors = result.issues.filter((i) => i.severity === "error");
  const warns = result.issues.filter((i) => i.severity === "warn");

  if (result.ok && warns.length === 0) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
        <ShieldCheck className="h-3 w-3" />
        Canvas-validering OK
        <span className="text-emerald-400/70">
          · {result.artifacts.flowBlocks.length} flow · {result.artifacts.mermaidBlocks.length}{" "}
          mermaid · {result.artifacts.canvasNotes.length} notes
        </span>
      </div>
    );
  }

  const tone =
    errors.length > 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-amber-500/40 bg-amber-500/10 text-amber-400";

  return (
    <div className={cn("mt-2 rounded-md border px-2.5 py-1.5 text-xs", tone)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 font-medium"
      >
        <ShieldAlert className="h-3 w-3" />
        {errors.length > 0
          ? `Canvas-validering: ${errors.length} fejl${warns.length ? `, ${warns.length} advarsel${warns.length === 1 ? "" : "ler"}` : ""}`
          : `Canvas-validering: ${warns.length} advarsel${warns.length === 1 ? "" : "ler"}`}
        <span className="opacity-60">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-4">
          {result.issues.map((i, idx) => (
            <li key={idx} className="list-disc">
              <span className="font-mono opacity-60">[{i.code}]</span> {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function diffCount(before: number, after: number): string {
  if (after === before) return `${after}`;
  const sign = after > before ? "+" : "−";
  return `${before} → ${after} (${sign}${Math.abs(after - before)})`;
}

function HealDiffPanel({ summary }: { summary: HealSummary }) {
  const [open, setOpen] = useState(false);
  const first = summary.attempts[0];
  const last = summary.attempts[summary.attempts.length - 1];
  const finalOk = summary.resolvedCodes.length > 0;
  const tone = finalOk
    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-300";

  return (
    <div className={cn("mt-2 rounded-md border px-2.5 py-1.5 text-xs", tone)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-between gap-2 font-medium"
      >
        <span className="inline-flex items-center gap-1.5">
          <Wrench className="h-3 w-3" />
          {finalOk
            ? `Self-heal: ${summary.attempts.length} forsøg · ${summary.resolvedCodes.length} fejl rettet`
            : `Self-heal udtømt efter ${summary.attempts.length} forsøg — gemmer trods ${last.issues.length} resterende issue(s)`}
        </span>
        <span className="opacity-60">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
            <span className="opacity-60">flow blocks</span>
            <span>
              {diffCount(first.artifactCounts.flowBlocks, summary.finalArtifactCounts.flowBlocks)}
            </span>
            <span className="opacity-60">mermaid</span>
            <span>
              {diffCount(
                first.artifactCounts.mermaidBlocks,
                summary.finalArtifactCounts.mermaidBlocks,
              )}
            </span>
            <span className="opacity-60">tables</span>
            <span>
              {diffCount(first.artifactCounts.tables, summary.finalArtifactCounts.tables)}
            </span>
            <span className="opacity-60">canvas notes</span>
            <span>
              {diffCount(first.artifactCounts.canvasNotes, summary.finalArtifactCounts.canvasNotes)}
            </span>
          </div>
          <div>
            <div className="mb-1 font-medium opacity-80">Issue-diff (oprindelig → endelig):</div>
            <ul className="space-y-0.5 pl-4">
              {first.issues.map((i, idx) => {
                const stillThere = last.issues.some(
                  (li) => li.code === i.code && li.message === i.message,
                );
                return (
                  <li
                    key={idx}
                    className={cn(
                      "list-disc",
                      stillThere ? "opacity-60" : "line-through opacity-70",
                    )}
                  >
                    <span className="font-mono opacity-70">[{i.code}]</span> {i.message}
                    {!stillThere && <span className="ml-1 text-emerald-400">✓ rettet</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          {summary.attempts.length > 1 && (
            <div className="opacity-70">
              Historik:{" "}
              {summary.attempts.map((a) => `#${a.attempt} (${a.issues.length} issues)`).join(" → ")}
              {finalOk && " → ✓ valid"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
