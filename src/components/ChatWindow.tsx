import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageContent } from "./MessageContent";
import { ArrowUp, Sparkles, StopCircle, PanelRightOpen, Copy, Check, Paperclip, X, FileText, ShieldAlert, ShieldCheck, Wrench, Brain } from "lucide-react";
import { useThreads } from "@/hooks/useThreads";
import { CanvasPanel } from "./CanvasPanel";
import { cn } from "@/lib/utils";
import { validateGemResponse, type ValidationResult } from "@/lib/gemResponseValidator";
import { ModelPicker } from "./ModelPicker";
import { useModelPreference } from "@/lib/modelPreference";

const SUGGESTIONS = [
  { title: "Forklar GraphRAG", body: "Forklar hvordan GraphRAG med Neo4j fungerer og hvornår det er bedre end vektor-RAG." },
  { title: "Resizable canvas plan", body: "Foreslå en konkret implementation af resizable workspace med strategic zoom." },
  { title: "Agent-arbitrage", body: "Skitsér Omega Sentinel multi-agent routing baseret på 10-point analyse." },
  { title: "Markdown demo", body: "Vis et eksempel-svar med headings, kode, liste og en lille tabel." },
];

function getText(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
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
  const lines = result.issues.map(
    (i) => `- [${i.severity.toUpperCase()} ${i.code}] ${i.message}`,
  );
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
  gem,
  onFirstMessage,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  gem?: GemContext;
  onFirstMessage?: () => void;
}) {
  const { upsertThread } = useThreads();
  const [input, setInput] = useState("");
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const healAttemptsRef = useRef<Map<string, number>>(new Map());
  const healChainRef = useRef(0);
  // Chain-scoped trace of every failed attempt, reset when the chain closes
  // (success or max retries). Used to render the diff on the final message.
  const healChainTraceRef = useRef<HealAttempt[]>([]);
  const [healingMessageId, setHealingMessageId] = useState<string | null>(null);
  const [healHistory, setHealHistory] = useState<Record<string, HealSummary>>({});
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  const [model] = useModelPreference();
  // AUR-5: "Reason deeply" toggle — persisted across reloads, sent with each
  // request so the server can pass `reflect: true` to the platform RLM.
  const [deepMode, setDeepMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("widgetdc.chat.deep") === "1";
  });
  const toggleDeep = useCallback(() => {
    setDeepMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("widgetdc.chat.deep", next ? "1" : "0");
      }
      return next;
    });
  }, []);
  // Per-request body (model / deep / persona) is read at SEND time via a ref so
  // the latest model-picker selection always reaches the request. The transport
  // is stable on purpose: useChat binds it once at init, so recreating it when
  // `model` changes does NOT take effect — that was the bug where the picker
  // selection was ignored and the server always received the initial model.
  const requestMetaRef = useRef({ model, deep: deepMode, system: gem?.systemPrompt });
  requestMetaRef.current = { model, deep: deepMode, system: gem?.systemPrompt };
  const buildRequestBody = useCallback(() => {
    const { model: m, deep, system } = requestMetaRef.current;
    return { model: m, deep, ...(system ? { system } : {}) };
  }, []);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);



  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => console.error("Chat error:", e),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Persist messages + fire onFirstMessage exactly once when the first
  // user message appears, so the parent route can navigate event-based
  // instead of polling localStorage.
  const firedFirstRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? getText(firstUser).slice(0, 60) || "Ny samtale" : "Ny samtale";
    upsertThread(threadId, { title, messages });
    if (firstUser && !firedFirstRef.current) {
      firedFirstRef.current = true;
      // onFirstMessage now updates the URL in place (history.replaceState) and
      // does NOT unmount us, so we must NOT show the creating-thread overlay —
      // it would cover the streaming reply. The stream keeps rendering here.
      onFirstMessage?.();
    }
  }, [messages, threadId, upsertThread, onFirstMessage]);

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
    const fileParts = files.map((a) => ({
      type: "file" as const,
      mediaType: a.file.type || "application/octet-stream",
      filename: a.file.name,
      url: a.dataUrl,
    }));
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
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        console.warn(`Skipper ${file.name}: over 8 MB`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        next.push({ file, dataUrl });
      } catch (err) {
        console.error("Kunne ikke læse fil:", err);
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const empty = messages.length === 0;

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
        <header className="flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {gem ? (
              <div className={cn(
                "rounded-md px-2 py-1 text-xs font-medium text-white bg-gradient-to-br",
                gem.accent ?? "from-primary to-primary",
              )}>
                Gem · {gem.name}
              </div>
            ) : null}
            <span className="text-sm text-muted-foreground">via WidgeTDC</span>
          </div>
          <div className="flex items-center gap-2">
            <ModelPicker />
            <button
              onClick={toggleDeep}
              aria-pressed={deepMode}
              title="Reason deeply — RLM reflektion + reasoning chain"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-accent",
                deepMode && "bg-primary/10 text-primary border-primary/40",
              )}
            >
              <Brain className="h-4 w-4" />
              Deep
            </button>
            <button
              onClick={() => setCanvasOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-accent",
                canvasOpen && "bg-accent text-accent-foreground",
              )}
            >
              <PanelRightOpen className="h-4 w-4" />
              Canvas
            </button>
          </div>
        </header>


        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center">
              <div className={cn(
                "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-glow",
                gem?.accent ? `bg-gradient-to-br ${gem.accent}` : "bg-gradient-aurora",
              )}>
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h1 className={cn(
                "bg-clip-text text-4xl font-semibold text-transparent",
                gem?.accent ? `bg-gradient-to-br ${gem.accent}` : "bg-gradient-aurora",
              )}>
                {gem ? gem.name : "Hej. Hvad arbejder vi på i dag?"}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {gem?.tagline ?? "WidgeTDC Aurora — drevet af WidgeTDC-platformen."}
              </p>
              <div className="mt-10 grid w-full grid-cols-1 gap-3 md:grid-cols-2">
                {(gem?.starters ?? SUGGESTIONS).map((s) => (
                  <button
                    key={s.title}
                    onClick={() => submit(s.body)}
                    className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-accent hover:shadow-soft"
                  >
                    <div className="text-sm font-medium text-card-foreground">{s.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.body}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" &&
                  i === messages.length - 1 &&
                  isLoading;
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
              {status === "submitted" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  {healingMessageId
                    ? `Self-heal forsøg ${healAttemptsRef.current.get(healingMessageId) ?? 1}/${MAX_HEAL_RETRIES} — retter canvas-struktur...`
                    : "Tænker..."}
                </div>
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
                        <div className="text-muted-foreground">{(a.file.size / 1024).toFixed(0)} KB</div>
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
                placeholder="Skriv din besked til Aurora..."
                rows={1}
                className="max-h-48 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                style={{ minHeight: "2.5rem" }}
              />
              {isLoading ? (
                <button
                  onClick={stop}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition hover:opacity-90"
                  aria-label="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => submit()}
                  disabled={!input.trim() && attachments.length === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-aurora text-white shadow-glow transition disabled:opacity-40 disabled:shadow-none"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Aurora kan tage fejl. Verificer vigtige svar. Træk filer ind eller indsæt billeder.
            </p>
          </div>
        </div>

      </div>

      {canvasOpen && (
        <CanvasPanel messages={messages} onClose={() => setCanvasOpen(false)} />
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
              <span className="text-sm font-medium text-foreground">{previewAttachment.file.name}</span>
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

  const fileParts = message.parts.filter((p) => p.type === "file") as Array<{
    type: "file";
    mediaType: string;
    url: string;
    filename?: string;
  }>;

  // AUR-5: pick up the data-reasoning part emitted by the server (RLM reflect).
  const reasoningPart = (message.parts as Array<{ type?: string; data?: unknown }>)
    .find((p) => p && p.type === "data-reasoning");
  const reasoningMeta = (reasoningPart?.data ?? null) as ReasoningMeta | null;

  // AUR-14: pick up the data-sources part (NEXUS/SRAG grounding) so the [n]
  // citations the server injected are actually visible to the user.
  const sourcesPart = (message.parts as Array<{ type?: string; data?: unknown }>).find(
    (p) => p && p.type === "data-sources",
  );
  const sources = (sourcesPart?.data as { sources?: ChatSource[] } | undefined)?.sources ?? [];

  const validation = useMemo<ValidationResult | null>(() => {
    if (skipValidation) return null;
    if (message.role !== "assistant") return null;
    if (!gemId) return null;
    if (!text.trim()) return null;
    return validateGemResponse(text, gemId);
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
        <MessageContent text={text} />
        {sources.length > 0 && <SourcesPanel sources={sources} />}
        {reasoningMeta && <ReasoningPanel meta={reasoningMeta} />}
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

function SourcesPanel({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
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
        {sources.map((s, i) => (
          <li key={i} className="leading-snug">
            {s.source && <span className="font-medium text-foreground">{s.source}: </span>}
            {s.text}
          </li>
        ))}
      </ol>
    </details>
  );
}

// AUR-5: client-side mirror of the server's ChatReasoningMeta shape.
type ReasoningMeta = {
  confidence?: number;
  reasoning?: string;
  reasoningChain?: string[];
  provider?: string;
  model?: string;
  domain?: string;
  latencyMs?: number;
  qualityScore?: number;
  reflectionAttempted?: boolean;
  reflectionKept?: boolean;
};

function ReasoningPanel({ meta }: { meta: ReasoningMeta }) {
  const [open, setOpen] = useState(false);
  const chain = meta.reasoningChain ?? [];
  const conf = typeof meta.confidence === "number" ? Math.round(meta.confidence * 100) : null;
  const quality =
    typeof meta.qualityScore === "number" ? Math.round(meta.qualityScore * 100) : null;
  const provider = meta.provider ?? null;
  const model = meta.model ?? null;
  const domain = meta.domain ?? null;
  const latency = typeof meta.latencyMs === "number" ? Math.round(meta.latencyMs) : null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-3 rounded-2xl border border-figure-border bg-figure-surface/40 px-4 py-3 text-xs"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 text-foreground">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Reasoning</span>
        {conf != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            {conf}% sikker
          </span>
        )}
        {quality != null && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            kvalitet {quality}
          </span>
        )}
        {meta.reflectionKept && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
            refleksion anvendt
          </span>
        )}
        {provider && (
          <span className="ml-auto truncate text-[10px] text-muted-foreground">
            {provider}
            {model && model !== provider ? ` · ${model}` : ""}
            {domain ? ` · ${domain}` : ""}
            {latency != null ? ` · ${latency}ms` : ""}
          </span>
        )}
      </summary>
      {chain.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          {chain.map((step, i) => (
            <li key={i} className="leading-snug">
              {step}
            </li>
          ))}
        </ol>
      )}
      {meta.reasoning && chain.length === 0 && (
        <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{meta.reasoning}</p>
      )}
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
          · {result.artifacts.flowBlocks.length} flow · {result.artifacts.mermaidBlocks.length} mermaid · {result.artifacts.canvasNotes.length} notes
        </span>
      </div>
    );
  }

  const tone = errors.length > 0
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
            <span>{diffCount(first.artifactCounts.flowBlocks, summary.finalArtifactCounts.flowBlocks)}</span>
            <span className="opacity-60">mermaid</span>
            <span>{diffCount(first.artifactCounts.mermaidBlocks, summary.finalArtifactCounts.mermaidBlocks)}</span>
            <span className="opacity-60">tables</span>
            <span>{diffCount(first.artifactCounts.tables, summary.finalArtifactCounts.tables)}</span>
            <span className="opacity-60">canvas notes</span>
            <span>{diffCount(first.artifactCounts.canvasNotes, summary.finalArtifactCounts.canvasNotes)}</span>
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
                    className={cn("list-disc", stillThere ? "opacity-60" : "line-through opacity-70")}
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
              Historik: {summary.attempts.map((a) => `#${a.attempt} (${a.issues.length} issues)`).join(" → ")}
              {finalOk && " → ✓ valid"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

