import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  Plus,
  MessageSquare,
  Settings,
  HelpCircle,
  Activity,
  Mic,
  ImagePlus,
  Hexagon,
  Send,
  ChevronDown,
  PanelRight,
  Sparkles,
  Sliders,
  LineChart,
  BookOpen,
  Search,
  Bell,
  Key,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
  Smartphone,
  Music,
  Database,
  ArrowRight,
  Sparkle,
  Zap,
  Globe,
  Trash2,
  Paperclip,
  Check
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/src/lib/utils";
import { Dashboard } from "@/src/components/Dashboard";
import { Settings as SettingsView } from "@/src/components/Settings";
import { Canvas } from "@/src/components/Canvas";

interface Message {
  role: "user" | "assistant";
  content: string;
  groundingSources?: Array<Record<string, unknown>>;
  intentConfidence?: number;
  targetTool?: string;
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  reasoningMode?: 'fast' | 'deep';
}

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
type OutputForgeStatus = "Draft" | "Grounded" | "Validated" | "Needs review";

const outputForgeStatuses: OutputForgeStatus[] = [
  "Draft",
  "Grounded",
  "Validated",
  "Needs review",
];

const outputStatusLabel: Record<OutputForgeStatus, string> = {
  Draft: "Draft",
  Grounded: "Source-backed",
  Validated: "Ready to share",
  "Needs review": "Check before sharing",
};

function isOutputForgeStatus(value: unknown): value is OutputForgeStatus {
  return (
    typeof value === "string" &&
    outputForgeStatuses.includes(value as OutputForgeStatus)
  );
}


export default function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const currentThread = threads.find((t) => t.id === currentThreadId);
  const messages = currentThread?.messages || [];

  const [input, setInput] = useState("");
  const [currentView, setCurrentView] = useState<
    "apps" | "gallery" | "dashboard" | "settings"
  >("apps");

  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [isTyping, setIsTyping] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Canvas State
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [canvasLanguage, setCanvasLanguage] = useState("markdown");
  const [canvasSize, setCanvasSize] = useState<"default" | "wide" | "focus">("default");
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [outputForgeType, setOutputForgeType] = useState<OutputForgeType>("Plan");
  const [outputForgeStatus, setOutputForgeStatus] = useState<OutputForgeStatus>("Draft");
  const isCanvasFocusMode = isCanvasOpen && canvasSize === "focus";
  const shouldPrioritizeCanvas =
    isCanvasOpen && canvasContent.trim().length > 0 && outputForgeStatus !== "Draft";
  const useResizableWorkspace = isCanvasOpen && !isCanvasFocusMode && isDesktopLayout;
  const showChatWorkspace =
    !isCanvasFocusMode && (!isCanvasOpen || !shouldPrioritizeCanvas || isDesktopLayout);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mermaid dynamic highlighting context state
  const [highlightedNode, setHighlightedNode] = useState<{ id: string; label: string } | null>(null);

  // Auto-scroll to highlighted message in chat when highlightedNode changes
  useEffect(() => {
    if (highlightedNode) {
      setTimeout(() => {
        const firstMatch = document.querySelector(".message-highlighted-bubble");
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 120);
    }
  }, [highlightedNode]);

  // Dynamic Modals State
  const [activeModal, setActiveModal] = useState<"api" | "whatsnew" | "search" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [backendThreadsEnabled, setBackendThreadsEnabled] = useState(false);

  // I'm feeling lucky templates
  const luckyPrompts = [
    "Build a conversational customer support engine linked to Gmail metadata schema",
    "Create a clean React todo list with beautiful physics animations and client-side custom hooks",
    "A fully functional meeting notes summarizer with backend service and governed routing auto-categorization",
    "Develop an enterprise knowledge base utilizing GraphRAG, Neo4j, and semantic entity retrieval",
    "Design a telemetry dashboard for Cloud Run containers with real-time health indicator lights",
  ];
  const [luckyIndex, setLuckyIndex] = useState(0);

  const handleOpenInCanvas = (content: string, language: string) => {
    setCanvasContent(content);
    setCanvasLanguage(language);
    setIsCanvasOpen(true);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Extract canvas artifacts from new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role === "assistant" && !isTyping) {
      const content = lastMessage.content;
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      let lastBlock = null;
      let lastLang = null;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        lastLang = match[1] || "markdown";
        lastBlock = match[2];
      }

      if (lastBlock) {
        if (lastLang !== "text") {
          setCanvasLanguage(lastLang);
          setCanvasContent(lastBlock.trim());
          setIsCanvasOpen(true);
        }
      } else {
        setCanvasLanguage("markdown");
        setCanvasContent(content.trim());
        setIsCanvasOpen(true);
      }
    }
  }, [messages, isTyping]);

  useEffect(() => {
    async function loadThreads() {
      try {
        const authRes = await fetch("/auth/status");
        const auth = authRes.ok ? await authRes.json() : { authenticated: false };
        if (!auth.authenticated) {
          const saved = localStorage.getItem("widgetdc_threads");
          if (saved) setThreads(JSON.parse(saved));
          setBackendThreadsEnabled(false);
          return;
        }

        setBackendThreadsEnabled(true);
        const res = await fetch("/api/threads");
        if (res.ok) {
          const data = await res.json();
          if (data.threads) {
            setThreads(data.threads);
          }
        }
      } catch (e) {
        console.warn("Failed to load threads from backend. Activating offline state.", e);
        const saved = localStorage.getItem("widgetdc_threads");
        if (saved) setThreads(JSON.parse(saved));
      }
    }
    loadThreads();
  }, []);

  const saveThreadToBackend = async (thread: Thread) => {
    if (!backendThreadsEnabled) {
      return;
    }

    try {
      await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thread),
      });
    } catch (e) {
      console.warn("Telemetry offline syncing state backup update.", e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
    if (e.target.value.endsWith("@")) {
      setShowExtensions(true);
    } else if (!e.target.value.includes("@")) {
      setShowExtensions(false);
    }
  };

  const updateThreadActive = (updatedThread: Thread, activeId: string) => {
    setThreads((prev) => {
      const filtered = prev.filter((t) => t.id !== activeId);
      const updated = [updatedThread, ...filtered].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      localStorage.setItem("widgetdc_threads", JSON.stringify(updated));
      return updated;
    });
    saveThreadToBackend(updatedThread);
  };

  const deleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      localStorage.setItem("widgetdc_threads", JSON.stringify(updated));
      return updated;
    });
    if (currentThreadId === id) {
      setCurrentThreadId(null);
    }
  };

  const toggleReasoningMode = () => {
     if (!currentThread) return;
     const updatedThread: Thread = {
        ...currentThread,
        reasoningMode: currentThread.reasoningMode === 'deep' ? 'fast' : 'deep',
        updatedAt: Date.now()
     };
     updateThreadActive(updatedThread, currentThread.id);
  };

  const handleSend = async (messageText?: string) => {
    const userMessage = messageText || input;
    if (!userMessage.trim() || isTyping) return;

    setInput("");
    setShowExtensions(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let activeId = currentThreadId;

    if (!activeId) {
      activeId = crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString();
      const newThread: Thread = {
        id: activeId,
        title:
          userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : ""),
        messages: [{ role: "user", content: userMessage }],
        updatedAt: Date.now(),
      };
      updateThreadActive(newThread, activeId);
      setCurrentThreadId(activeId);
    } else {
      const activeThread = threads.find((t) => t.id === activeId);
      if (activeThread) {
        const updatedThread = {
          ...activeThread,
          messages: [
            ...activeThread.messages,
            { role: "user" as const, content: userMessage },
          ],
          updatedAt: Date.now(),
        };
        updateThreadActive(updatedThread, activeId);
      }
    }

    setIsTyping(true);

    try {
      const res = await fetch("/api/widgetdc/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "intent_detect",
          payload: {
            query: userMessage,
            enabled_tools:
              userMessage.match(/@(NotebookLM|Deep|GraphRAG|Omega)/g) || [],
            reasoningMode: currentThread?.reasoningMode || 'fast',
          },
        }),
      });

      let data: any = null;
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        const cleanText = text.includes("<!DOCTYPE") || text.includes("<html")
          ? `HTTP ${res.status}: HTML response received (this usually means the request hit a bad gateway, offline proxy, or static fallback route)`
          : `HTTP ${res.status}: ${text.slice(0, 150)}`;
        throw new Error(cleanText);
      }
      let assistantText = "";

      if (res.ok && data && !data.error) {
        if (isOutputForgeStatus(data._output_status)) {
          setOutputForgeStatus(data._output_status);
        }
        if (typeof data._output_type === "string" && outputForgeTypes.some((item) => item.type === data._output_type)) {
          setOutputForgeType(data._output_type as OutputForgeType);
        }
        if (typeof data._canvas_content === "string") {
          setCanvasLanguage(data._canvas_language || "markdown");
          setCanvasContent(data._canvas_content.trim());
          setIsCanvasOpen(true);
        }

        if (data._simulated_tools) {
          const body =
            typeof data.intent === "string"
              ? data.intent
              : data.result?.recommendation
                ? data.result.recommendation
              : data.result?.plan?.recommendation
                ? data.result.plan.recommendation
              : "```json\n" +
                (data.plan?.result?.recommendation ||
                  data.result?.plan?.recommendation ||
                  data.result?.recommendation ||
                  JSON.stringify(data, null, 2)) +
                "\n```";
          assistantText = `### Agentic Execution Chain\n\`\`\`text\n${data._simulated_tools}\n\`\`\`\n\n**Loop Contract:** Inventor pattern retrieval -> RIEC risk gate -> tool route -> grounded answer -> operator review. Max 3 self-correction passes before escalation.\n\n---\n\n${body}`;
          if (data.result?.adoption_candidate?.can_save_pattern) {
            assistantText += "\n\n**Next action:** Save this successful chain as a reusable pattern candidate after review.";
          }
        } else if (data.result?.candidates) {
          const candidates = data.result.candidates;
          let md = `**Orchestrator Routing Analysis**\n\nQuery: *"${data.result.query}"*\n\nIdentified MCP Paths:\n\n`;
          candidates.slice(0, 5).forEach((c: { tool: string; score: number }, i: number) => {
            md += `${i + 1}. **\`${c.tool}\`** (Confidence: ${c.score.toFixed(2)})\n`;
          });
          assistantText = md;
        } else {
          const content =
            data.plan?.result?.recommendation ||
            data.result?.plan?.recommendation ||
            data.result?.recommendation ||
            data.intent ||
            JSON.stringify(data, null, 2);
          assistantText =
            typeof content === "string" && !content.startsWith("{")
              ? content
              : "```json\n" + JSON.stringify(data, null, 2) + "\n```";
        }
      } else {
        assistantText = `Error from WidgeTDC Ingress: ${data.error || data._error || res.statusText || "Fallback generated offline"}`;
      }

      setThreads((prev) => {
        const activeThread = prev.find((t) => t.id === activeId);
        if (!activeThread) return prev;
        const updatedThread = {
          ...activeThread,
          messages: [
            ...activeThread.messages,
            {
              role: "assistant",
              content: assistantText,
              groundingSources: data?.groundingSources,
              intentConfidence: data?._intent_confidence,
              targetTool: data?._target_tool,
            } as Message,
          ],
          updatedAt: Date.now(),
        };

        const filtered = prev.filter((t) => t.id !== activeId);
        const updated = [updatedThread, ...filtered].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        localStorage.setItem("widgetdc_threads", JSON.stringify(updated));
        saveThreadToBackend(updatedThread);
        return updated;
      });
    } catch (e: unknown) {
      const err = e as Error;
      setThreads((prev) => {
        const activeThread = prev.find((t) => t.id === activeId);
        if (!activeThread) return prev;
        const updatedThread = {
          ...activeThread,
          messages: [
            ...activeThread.messages,
            { role: "assistant", content: `Error: ${err.message}` } as Message,
          ],
          updatedAt: Date.now(),
        };
        const filtered = prev.filter((t) => t.id !== activeId);
        const updated = [updatedThread, ...filtered].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        localStorage.setItem("widgetdc_threads", JSON.stringify(updated));
        saveThreadToBackend(updatedThread);
        return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handlePillClick = (val: string) => {
    setInput(val);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLuckyClick = () => {
    setInput(luckyPrompts[luckyIndex]);
    setLuckyIndex((prev) => (prev + 1) % luckyPrompts.length);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleConnectorPillClick = (conn: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} @${conn} ` : `@${conn} `;
    });
    setShowExtensions(true);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const extensions = [
    { name: "Inventor Pattern Search", icon: "I" },
    { name: "RIEC Governance Loop", icon: "R" },
    { name: "NotebookLM Grounding", icon: "N" },
    { name: "Deep Research Agent", icon: "D" },
    { name: "GraphRAG (Neo4j)", icon: "G" },
    { name: "Omega Sentinel Routing", icon: "O" },
  ];

  // Suggestions row definition
  const rawSuggestions = [
    { text: "Check System Health", icon: <Activity className="w-4 h-4 text-emerald-400" />, prompt: "Check platform database and ingress gateways health status using get_system_health" },
    { text: "Emit Sonar Pulse", icon: <Zap className="w-4 h-4 text-purple-400" />, prompt: "Emit system-wide sonar pulse using emit_sonar_pulse to explore graph entity mappings" },
    { text: "Develop Flow Diagram", icon: <Sliders className="w-4 h-4 text-blue-400" />, prompt: "Generate process flow blueprint and RLM diagram using flow-develop" },
    { text: "Run Inventor/RIEC Loop", icon: <Hexagon className="w-4 h-4 text-cyan-400" />, prompt: "Use @Inventor Pattern Search @RIEC Governance Loop to identify best implementation patterns, risk-gate them, and establish a max-3-pass correction chain." },
    { text: "Run TDD Diagnostics", icon: <Check className="w-4 h-4 text-amber-400" />, prompt: "Execute automated automated test coverage across defined units using skill-tdd" },
    { text: "Fetch Dashboard Data", icon: <LineChart className="w-4 h-4 text-pink-400" />, prompt: "Retrieve current metrics using platform.get_dashboard_data" },
  ];

  const outputForgeTypes: Array<{ type: OutputForgeType; prompt: string }> = [
    { type: "Plan", prompt: "Generate Output Forge Plan for the current implementation using harvest-to-pattern-library -> visualization-system-loop -> reuse-before-design -> research-to-standard -> standard-to-implementation -> adoption-flywheel." },
    { type: "Diagram", prompt: "Generate Output Forge Diagram as Mermaid for the current architecture using harvest-to-pattern-library -> visualization-system-loop -> reuse-before-design -> research-to-standard -> standard-to-implementation -> adoption-flywheel." },
    { type: "Report", prompt: "Generate Output Forge Report markdown for the current delivery decision using grounded sections and implementation next steps." },
    { type: "Deck", prompt: "Generate Output Forge Deck outline for stakeholders with slide titles, bullets, and speaker notes." },
    { type: "Risk", prompt: "Generate Output Forge RIEC Risk report with controls, mitigations, and review status." },
    { type: "Dashboard", prompt: "Generate Output Forge Dashboard summary with current metrics, status, and operator actions." },
    { type: "Gap Report", prompt: "Generate Output Forge Gap Report using symptom -> best-practice principle -> expected complaint -> moat -> acceptance test." },
    { type: "Trust Check", prompt: "Generate Output Forge Trust Check that explains Ready to share, Needs source, Assumption, and What should I check before sharing." },
    { type: "Consulting Structure", prompt: "Generate Output Forge Consulting Structure using SCR, MECE, issue tree, options, trade-offs, and recommendation." },
    { type: "Reproducibility Pack", prompt: "Generate Output Forge Reproducibility Pack with dataset snapshot, transform trace, eval metadata, notebook export, and prompt lineage." },
  ];

  const handleOutputForgeType = (type: OutputForgeType) => {
    const forgeType = outputForgeTypes.find((item) => item.type === type);
    setOutputForgeType(type);
    setOutputForgeStatus("Draft");
    setInput(forgeType?.prompt || `Generate Output Forge ${type}`);
    setCanvasLanguage("markdown");
    setCanvasContent(`## Output Forge: ${type}\n\n**Status:** Draft\n\nRefine the prompt, then send to generate the canvas output.`);
    setIsCanvasOpen(isDesktopLayout);
    textareaRef.current?.focus();
  };

  const connectorPills = [
    { name: "Inventor", label: "I", color: "text-cyan-300" },
    { name: "RIEC", label: "R", color: "text-amber-300" },
    { name: "NotebookLM", label: "N", color: "text-[#34A853]" },
    { name: "Deep", label: "D", color: "text-purple-400" },
    { name: "GraphRAG", label: "G", color: "text-[#4285F4]" },
    { name: "Omega", label: "O", color: "text-[#EA4335]" },
  ];

  const ArchitectMark = () => (
    <svg className="w-10 h-10 select-none animate-pulse shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="aiStudioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#448aff" />
          <stop offset="50%" stopColor="#9e00c5" />
          <stop offset="100%" stopColor="#ff5252" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.523 7.523 12 2 12C7.523 12 12 16.477 12 22C12 16.477 16.477 12 22 12C16.477 12 12 7.523 12 2Z"
        fill="url(#aiStudioGrad)"
      />
    </svg>
  );

  return (
    <div className="flex h-screen bg-[#131416] text-[#E3E3E8] font-sans selection:bg-[#4d6bfe]/30 overflow-hidden">
      {/* Search Overlay Modal */}
      {activeModal === "search" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
          <div className="bg-[#1e1e21] border border-[#2a2b30] w-full max-w-[650px] rounded-2xl shadow-2xl p-4 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#2a2b30] pb-3 mb-3">
              <Search className="w-5 h-5 text-[#8e8e93]" />
              <input
                type="text"
                autoFocus
                placeholder="Search threads, configurations and actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent flex-1 outline-none text-white text-[15px] placeholder:text-[#8e8e93]"
              />
              <button onClick={() => setActiveModal(null)} className="text-[#8e8e93] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              <p className="text-xs text-[#8e8e93] font-semibold px-2 mb-2">Matched History Threads</p>
              {threads
                .filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setCurrentThreadId(thread.id);
                      setCurrentView("apps");
                      setActiveModal(null);
                    }}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2c2d30] text-sm text-left transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-[#8e8e93]" />
                    <span className="text-white truncate flex-1">{thread.title}</span>
                  </button>
                ))}
              {threads.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <div className="text-[#8e8e93] p-4 text-center text-xs">No result matches the keyword</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Get API Key Modal */}
      {activeModal === "api" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1e21] border border-[#2a2b30] w-full max-w-[500px] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#2a2b30] flex justify-between items-center bg-[#18191b]">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#4da1fe]" />
                <h3 className="text-lg font-medium text-white">ArchitectGPT Runtime Configuration</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8e8e93] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#c4c4ca] leading-relaxed">
                ArchitectGPT routes prompt engineering and backend synthesis through server-managed runtime keys.
              </p>
              <div className="bg-[#131416] p-4 rounded-xl border border-[#2a2b30] space-y-2">
                <div className="text-xs text-[#8e8e93] font-bold uppercase tracking-wider">How to authenticate:</div>
                <p className="text-xs text-[#c4c4ca] leading-relaxed">
                  Provide runtime credentials through the server environment or backend config file. Never expose them in the browser bundle:
                </p>
                <div className="bg-[#1e1f22] p-2 rounded border border-[#2a2b32] font-mono text-xs text-[#4da1fe] overflow-x-auto whitespace-nowrap">
                  RUNTIME_MODEL_KEY=${"{RUNTIME_MODEL_KEY}"}
                </div>
              </div>
              <div className="text-[11px] text-[#8e8e93] leading-relaxed">
                The built-in intelligence router automatically checks for presence of variables. If no variable is defined, an offline simulated response handles the compilation layout directly.
              </div>
            </div>
            <div className="p-4 bg-[#18191b] border-t border-[#2a2b30] flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-[#131416] hover:bg-[#eaeaea] transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What's New Modal */}
      {activeModal === "whatsnew" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1e21] border border-[#2a2b30] w-full max-w-[550px] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#2a2b30] flex justify-between items-center bg-[#18191b]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-medium text-white">WidgeTDC 3.1 Releases</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8e8e93] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto android-scroll">
              <div className="space-y-2 border-b border-[#2a2b30]/60 pb-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Full-Stack Core compilation</h4>
                  <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full font-bold">Latest Upgrade</span>
                </div>
                <p className="text-xs text-[#c4c4ca] leading-relaxed">
                  Express and Vite middleware compilation is bundled into CJS outputs. Zero-config offline rendering and fast container cold starts.
                </p>
              </div>
              <div className="space-y-2 border-b border-[#2a2b30]/60 pb-3">
                <h4 className="text-sm font-semibold text-white">NotebookLM Integration</h4>
                <p className="text-xs text-[#c4c4ca] leading-relaxed">
                  Support grounding via Obsidian collections. Context injections are routed to the neural bridge for reliable contextual responses.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">GraphRAG & Neo4j Entities</h4>
                <p className="text-xs text-[#c4c4ca] leading-relaxed">
                  Traverse high-dimensional entity graphs on demand to secure knowledge graphs and context matrices directly from deep reasoning paths.
                </p>
              </div>
            </div>
            <div className="p-4 bg-[#18191b] border-t border-[#2a2b30] flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-[#131416] hover:bg-[#eaeaea] transition-colors"
              >
                Close Changelog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <div
        className={cn(
          "bg-[#1a1a1c] border-r border-[#262629] flex flex-col transition-all duration-300 ease-in-out shrink-0 relative z-30 select-none h-full max-lg:absolute max-lg:inset-y-0 max-lg:left-0",
          isSidebarOpen && !isCanvasFocusMode ? "w-[280px]" : "w-0 overflow-hidden border-r-0"
        )}
        aria-hidden={isCanvasFocusMode}
      >
        <div className="p-4 w-[280px] flex items-center justify-between border-b border-[#262629]/50">
          <div className="flex items-center gap-2 cursor-pointer group">
            <span className="text-[17px] font-medium tracking-tight text-white group-hover:text-neutral-200 transition-colors">
              ArchitectGPT
            </span>
            <ChevronDown className="w-4 h-4 text-[#8e8e93] group-hover:text-white transition-colors" />
          </div>
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 w-[280px] overflow-y-auto mt-3 px-4 space-y-6 android-scroll">
          {/* Playground collapsible menu */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-[#8e8e93] px-3.5 py-2 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" /> Playground
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
            
            {/* History Nested Item */}
            <div className="pl-3.5 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-[#68686d] px-2.5 py-1.5 font-bold">
                Recent Chats
              </div>
              <div className="space-y-0.5 max-h-[160px] overflow-y-auto android-scroll pr-1">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setCurrentThreadId(thread.id);
                      setCurrentView("apps");
                    }}
                    className={cn(
                      "flex items-center justify-between w-full group/item p-2 rounded-lg cursor-pointer transition-colors text-xs text-left truncate",
                      currentThreadId === thread.id && currentView === "apps"
                        ? "bg-[#2c2d30] text-white"
                        : "text-[#c4c4ca] hover:bg-[#222225] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <MessageSquare className="w-3.5 h-3.5 text-[#8e8e93] shrink-0" />
                      <span className="truncate">{thread.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteThread(thread.id, e)}
                      title="Delete thread"
                      className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-[#3e3f44] text-[#8e8e93] hover:text-white transition-all shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {threads.length === 0 && (
                  <div className="px-2.5 py-2 text-xs text-[#8e8e93] italic">
                    No historic chats
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Build collapsible item */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-[#8e8e93] px-3.5 py-2 uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Build
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>

            <div className="pl-3.5 space-y-1">
              {/* Apps landing page */}
              <button
                onClick={() => {
                  setCurrentThreadId(null);
                  setCurrentView("apps");
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs text-left transition-colors font-medium",
                  currentThreadId === null && currentView === "apps"
                    ? "bg-[#2c2d30] text-white font-semibold"
                    : "text-[#c4c4ca] hover:bg-[#222225] hover:text-white"
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Apps (Lander)</span>
              </button>

              {/* Gallery view */}
              <button
                onClick={() => {
                  setCurrentView("gallery");
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs text-left transition-colors font-medium",
                  currentView === "gallery"
                    ? "bg-[#2c2d30] text-white font-semibold"
                    : "text-[#c4c4ca] hover:bg-[#222225] hover:text-white"
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>Gallery Templates</span>
              </button>
            </div>
          </div>

          {/* Additional static sections */}
          <div className="space-y-1">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={cn(
                "flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs text-left transition-colors font-semibold group",
                currentView === "dashboard"
                  ? "bg-[#2c2d30] text-white"
                  : "text-[#c4c4ca] hover:bg-[#222225]"
              )}
            >
              <span className="flex items-center gap-2.5">
                <LineChart className="w-4 h-4 text-[#8e8e93]" /> Dashboard
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#8e8e93] group-hover:text-white transition-colors" />
            </button>

            <a
              href="https://docs.widgetdc.local/architectgpt"
              target="_blank"
              rel="referrer"
              className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs text-left transition-colors font-semibold text-[#c4c4ca] hover:bg-[#222225]"
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#8e8e93]" /> Documentation
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-[#8e8e93]" />
            </a>
          </div>
        </div>

        {/* Sticky bottom items with exact layout from screenshot */}
        <div className="p-4 bg-[#131416]/50 border-t border-[#262629]/50 space-y-0.5 text-xs text-[#c4c4ca] w-[280px]">
          <button
            onClick={() => setActiveModal("search")}
            className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#222225] transition-colors font-medium text-left"
          >
            <Search className="w-4 h-4 text-[#8e8e93]" />
            <span>Search</span>
          </button>
          <button
            onClick={() => setActiveModal("whatsnew")}
            className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#222225] transition-colors font-medium text-left"
          >
            <Bell className="w-4 h-4 text-[#8e8e93]" />
            <span>What's new</span>
          </button>
          <button
            onClick={() => setActiveModal("api")}
            className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#222225] transition-colors font-medium text-left"
          >
            <Key className="w-4 h-4 text-[#8e8e93]" />
            <span>Get API key</span>
          </button>
          <button
            onClick={() => setCurrentView("settings")}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#222225] transition-colors font-medium text-left",
              currentView === "settings" && "bg-[#2c2d30] text-white font-semibold"
            )}
          >
            <Settings className="w-4 h-4 text-[#8e8e93]" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-full bg-[#131314] relative overflow-hidden">
        {/* Top bar with custom toggle */}
        <header className="flex items-center justify-between p-4 px-5 relative z-10 w-full shrink-0 border-b border-[#262629]/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Left Sidebar"
              className={cn(
                "p-2 bg-[#212124] hover:bg-[#2c2d30] text-[#c4c4ca] hover:text-white rounded-lg transition-all items-center justify-center border border-[#2a2b30] shadow-sm shrink-0",
                isCanvasFocusMode ? "hidden" : "flex",
              )}
            >
              <div className="flex items-center gap-0.5">
                <Menu className="w-4 h-4" />
                {isSidebarOpen ? (
                  <ChevronLeft className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </div>
            </button>
            <div className="text-[17px] font-medium tracking-tight flex items-center gap-1.5 bg-[#212124] px-3.5 py-1.5 rounded-xl border border-[#2a2b30] text-[#c4c4ca]">
              <span>Console View</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCanvasOpen(!isCanvasOpen)}
              className={cn(
                "p-2 bg-[#212124] hover:bg-[#2c2d30] rounded-xl transition-all border border-[#2a2b30] shadow-sm text-xs font-semibold flex items-center gap-1.5",
                isCanvasOpen ? "text-[#4da1fe]" : "text-[#c4c4ca]"
              )}
              title="Toggle Side Canvas Output"
            >
              <PanelRight className="w-4 h-4" />
              <span>Canvas</span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-[#2a2b30] shadow-sm hover:scale-105 transition-transform group relative">
              <span className="text-white font-bold text-xs">C</span>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[9px] text-white font-semibold">User</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Display Panel */}
        <div className="flex-grow overflow-hidden relative">
          {currentView === "dashboard" ? (
            <div className="h-full w-full overflow-y-auto">
              <Dashboard />
            </div>
          ) : currentView === "settings" ? (
            <div className="h-full w-full overflow-y-auto">
              <SettingsView />
            </div>
          ) : currentView === "gallery" ? (
            <div className="h-full w-full overflow-y-auto p-8 max-w-[1000px] mx-auto android-scroll">
              <div className="mb-6">
                <h2 className="text-3xl font-medium text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="text-[#a162fc] w-6.5 h-6.5" /> Creative Applications Gallery
                </h2>
                <p className="text-sm text-[#8e8e93] mt-1">Explore pre-designed neural mockups built to compile directly into WidgeTDC architectures.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <div
                  onClick={() => {
                    setCurrentView("apps");
                    setCurrentThreadId(null);
                    handlePillClick("Build a fully functional meeting notes summarizer with backend service and governed routing auto-categorization");
                  }}
                  className="bg-[#1e1e21] border border-[#2a2b30] hover:border-indigo-500/50 p-6 rounded-2xl shadow-sm hover:shadow-indigo-500/5 cursor-pointer hover:bg-[#25262a] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-full">Automations</span>
                    <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">Meeting Notes Summarizer</h4>
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    Auto-synthesizes conversational timelines into clear bullet items. Uses backend-isolated prompt chains.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setCurrentView("apps");
                    setCurrentThreadId(null);
                    handlePillClick("Develop query triggers across a Spanner DB to analyze stock transactions on-demand");
                  }}
                  className="bg-[#1e1e21] border border-[#2a2b30] hover:border-emerald-500/50 p-6 rounded-2xl shadow-sm hover:shadow-emerald-500/5 cursor-pointer hover:bg-[#25262a] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full">Data Science</span>
                    <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">Spanner DB transaction analyzer</h4>
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    Performs transactional evaluation with sub-millisecond response guarantees. Integrates interactive dashboards.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setCurrentView("apps");
                    setCurrentThreadId(null);
                    handlePillClick("Configure real-time telemetry pipelines connecting connected devices under a robust express backend with fallback modes");
                  }}
                  className="bg-[#1e1e21] border border-[#2a2b30] hover:border-amber-500/50 p-6 rounded-2xl shadow-sm hover:shadow-amber-500/5 cursor-pointer hover:bg-[#25262a] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2.5 py-1 rounded-full">Hardware</span>
                    <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">IoT Live Telemetry Node</h4>
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    Monitors hardware ping streams to reveal connectivity spikes. Preserves offline telemetry buffers.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setCurrentView("apps");
                    setCurrentThreadId(null);
                    handlePillClick("Generate high-dimensional graph models of global corporate workflows using Neo4j schemas");
                  }}
                  className="bg-[#1e1e21] border border-[#2a2b30] hover:border-pink-500/50 p-6 rounded-2xl shadow-sm hover:shadow-pink-500/5 cursor-pointer hover:bg-[#25262a] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-pink-400 uppercase tracking-widest bg-pink-500/10 px-2.5 py-1 rounded-full">RAG Engine</span>
                    <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">Neo4j High-Dimensional Graph</h4>
                  <p className="text-xs text-[#8e8e93] leading-relaxed">
                    Extracts structural entites to power contextual indexing loops inside GraphRAG frameworks.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Home / Chat View */
            <Group
              id="widgetdc-output-workspace"
              orientation="horizontal"
              className="h-full w-full"
            >
              {showChatWorkspace && (
                <Panel
                  id="chat-workspace"
                  defaultSize={useResizableWorkspace ? "36%" : "100%"}
                  minSize={useResizableWorkspace ? "320px" : "0px"}
                  maxSize={useResizableWorkspace ? "70%" : "100%"}
                  collapsible={isCanvasOpen}
                  className="min-w-0"
                >
                <div
                  className={cn(
                    "flex flex-col h-full w-full relative z-10 select-text bg-[#121316]",
                    isCanvasOpen && "border-r border-[#262629]/30",
                  )}
                >
                {/* Chat Stream / App Input Block Area */}
                <div
                  className="flex-1 overflow-y-auto px-4 md:px-0 w-full android-scroll relative"
                  ref={scrollRef}
                >
                  <div
                    className={cn(
                      "mx-auto w-full h-full flex flex-col pt-4 pb-6",
                      isCanvasOpen ? "max-w-none px-3" : "max-w-[850px]",
                    )}
                  >
                    {currentThreadId === null && messages.length === 0 ? (
                      /* Landing Page replicating the uploaded Screenshot */
                      <div className="flex flex-col flex-grow items-center justify-center p-4 min-h-[80%] pt-10 md:pt-14 select-none">
                        {/* Title block with custom star */}
                        <div className="flex items-center gap-4 text-center justify-center mb-10">
                          <h1 className="text-[34px] md:text-[46px] font-normal text-[#f4f4f6] tracking-tight text-center">
                            Build with ArchitectGPT
                          </h1>
                          <ArchitectMark />
                        </div>

                        {/* Search Input Box with colorful glow borders */}
                        <div className="relative group/box rounded-3xl p-[1.5px] bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-orange-400/30 focus-within:from-purple-500 focus-within:via-blue-500 focus-within:to-orange-400 transition-all duration-500 shadow-[0_0_25px_rgba(99,102,241,0.03)] focus-within:shadow-[0_0_35px_rgba(99,102,241,0.12)] max-w-[850px] mx-auto w-full mb-8">
                          <div className="bg-[#1e1e21] rounded-[22px] p-4 flex flex-col min-h-[150px] justify-between">
                            <textarea
                              ref={textareaRef}
                              value={input}
                              onChange={handleInput}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSend();
                                }
                              }}
                              placeholder="Describe an app and let ArchitectGPT build the route"
                              className="w-full bg-transparent resize-none outline-none text-[16px] leading-relaxed placeholder:text-[#8e8e93] text-white font-normal"
                              rows={2}
                            />
                            <div className="flex justify-between items-center pt-2 border-t border-[#262629]/50 mt-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handlePillClick("Perform speecheSynthesis evaluation on text fragments.")}
                                  title="Microphone input"
                                  className="p-2.5 text-[#8e8e93] hover:bg-[#2c2d30] hover:text-white rounded-full transition-all border border-[#2a2b30]"
                                >
                                  <Mic className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handlePillClick("Add standard asset directories or configure Supabase schemas")}
                                  title="Add resources"
                                  className="p-2.5 text-[#8e8e93] hover:bg-[#2c2d30] hover:text-white rounded-full transition-all border border-[#2a2b30]"
                                >
                                  <Paperclip className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleLuckyClick}
                                  type="button"
                                  className="px-4 py-2 bg-[#2c2d30] border border-[#3b3c43] text-xs font-semibold text-white rounded-full hover:bg-[#34353a] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                  <span>I'm feeling lucky</span>
                                </button>
                                {input.trim() && (
                                  <button
                                    onClick={() => handleSend()}
                                    className="p-2.5 bg-white text-[#131314] hover:bg-neutral-200 rounded-full transition-all flex items-center justify-center shadow-md animate-fade-in"
                                  >
                                    <Send className="w-3.5 h-3.5 ml-0.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-5 rounded-2xl border border-[#262629] bg-[#1a1a1c] px-3 py-2 max-w-[850px] w-full">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="flex items-center gap-2 mr-1">
                              <Sparkles className="w-3.5 h-3.5 text-[#4da1fe]" />
                              <span className="text-xs font-semibold text-[#c4c4ca]">Output Forge</span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border",
                                outputForgeStatus === "Validated" && "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
                                outputForgeStatus === "Grounded" && "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
                                outputForgeStatus === "Needs review" && "text-amber-300 border-amber-500/30 bg-amber-500/10",
                                outputForgeStatus === "Draft" && "text-[#8e8e93] border-[#2a2b30] bg-[#131314]"
                              )}>
                                {outputStatusLabel[outputForgeStatus]}
                              </span>
                            </div>
                            {outputForgeTypes.map((item) => (
                              <button
                                key={item.type}
                                onClick={() => handleOutputForgeType(item.type)}
                                className={cn(
                                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                  outputForgeType === item.type
                                    ? "bg-[#4da1fe]/10 text-[#8ec5ff] border-[#4da1fe]/30"
                                    : "bg-[#131314] text-[#8e8e93] border-[#262629] hover:text-white hover:bg-[#222225]"
                                )}
                              >
                                {item.type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Suggestion Row 1 */}
                        <div className="w-full max-w-[850px] overflow-hidden relative group/scroller-1 mb-3.5">
                          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scroll-smooth hidden-scrollbar pr-8 android-scroll">
                            {rawSuggestions.map((s, idx) => (
                              <button
                                key={idx}
                                onClick={() => handlePillClick(s.prompt)}
                                className="flex items-center gap-2 bg-[#1e1e21] border border-[#262629] px-4 py-2.5 rounded-full text-xs font-medium text-[#c4c4ca] hover:bg-[#2c2d30] hover:border-[#3b3c43] hover:text-white transition-all whitespace-nowrap shadow-sm cursor-pointer"
                              >
                                {s.icon}
                                <span>{s.text}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Suggestion Row 2 */}
                        <div className="w-full max-w-[850px] overflow-hidden relative group/scroller-2">
                          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scroll-smooth hidden-scrollbar pr-8 android-scroll">
                             {connectorPills.map((p, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleConnectorPillClick(p.name)}
                                className="flex items-center gap-2 bg-[#1e1e21] border border-[#262629] px-4 py-2.5 rounded-full text-xs font-medium text-[#c4c4ca] hover:bg-[#2c2d30] hover:border-[#3b3c43] hover:text-white transition-all whitespace-nowrap shadow-sm cursor-pointer"
                              >
                                <span className={cn("font-bold text-[14px]", p.color)}>{p.label}</span>
                                <span>{p.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Active Conversation Template */
                      <div className="flex flex-col space-y-8 w-full p-4 mb-4 select-text">
                        {highlightedNode && (
                          <div className="flex items-center justify-between bg-indigo-950/20 border border-indigo-500/20 px-4 py-3 rounded-2xl text-xs text-indigo-200 shadow-sm animate-fade-in shrink-0 mb-2 w-full max-w-full">
                            <div className="flex items-center gap-2.5">
                              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                              <span>Focusing component: <strong className="text-white font-semibold">{highlightedNode.label}</strong> <span className="text-[10px] font-mono text-indigo-400 opacity-90">(ID: {highlightedNode.id})</span></span>
                            </div>
                            <button 
                              onClick={() => setHighlightedNode(null)} 
                              className="text-[10px] text-indigo-400 hover:text-white font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              Clear Focus
                            </button>
                          </div>
                        )}
                        {messages.map((m, i) => {
                          const isHighlighted = highlightedNode && m.role === "assistant" && (
                            m.content.toLowerCase().includes(highlightedNode.id.toLowerCase()) || m.content.toLowerCase().includes(highlightedNode.label.toLowerCase())
                          );
                          return (
                            <div
                              key={i}
                              className={cn(
                                "flex w-full message-bubble-container",
                                m.role === "user" ? "justify-end" : "justify-start"
                              )}
                            >
                              {m.role === "assistant" && (
                                <div className="w-8 h-8 mr-4 mt-1 relative flex-shrink-0 flex items-center justify-center bg-indigo-500/10 rounded-full border border-indigo-500/20">
                                  <Hexagon className="w-4 h-4 text-indigo-400" />
                                </div>
                              )}
                              <div
                                className={cn(
                                  "max-w-[85%] text-[15px] relative transition-all duration-300",
                                  m.role === "user"
                                    ? "bg-[#2c2d30] text-white px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] font-normal leading-relaxed shadow-sm border border-[#3c3d44]"
                                    : cn(
                                        "text-[#E3E3E8] prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1E1F22] prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:shadow-sm",
                                        isHighlighted && "message-highlighted-bubble border border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.25)] bg-indigo-500/5 px-6 py-4 rounded-3xl"
                                      )
                                )}
                              >
                                {isHighlighted && (
                                  <div className="flex items-center gap-1.5 mb-2.5 text-indigo-400 text-[11px] font-bold font-mono animate-pulse uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                    <span>Selected Component Context: {highlightedNode.label}</span>
                                  </div>
                                )}
                              {m.role === "user" ? (
                                m.content
                              ) : (
                                <div className="markdown-body w-full">
                                  <ReactMarkdown
                                    components={{
                                      pre({ children }: any) {
                                        return <>{children}</>;
                                      },
                                      code({
                                        node,
                                        inline,
                                        className,
                                        children,
                                        ...props
                                      }: any) {
                                        const match = /language-(\w+)/.exec(
                                          className || ""
                                        );
                                        const language = match
                                          ? match[1]
                                          : "text";
                                        if (!inline && match) {
                                          const codeText = String(children).replace(/\n$/, "");
                                          return language === "mermaid" ? (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenInCanvas(codeText, language)}
                                              className="not-prose mb-4 flex w-full items-center justify-between gap-4 border-l-2 border-[#4da1fe] bg-[#161719] px-4 py-3 text-left transition-colors hover:bg-[#1d1f23] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da1fe]/70"
                                            >
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-[#E8EAED]">
                                                  Mermaid diagram
                                                </div>
                                                <div className="mt-1 truncate text-xs text-[#A1A1A8]">
                                                  Interactive view is available in Canvas
                                                </div>
                                              </div>
                                              <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#4da1fe]">
                                                <span>Open</span>
                                                <PanelRight className="h-3.5 w-3.5" />
                                              </div>
                                            </button>
                                          ) : (
                                            <div className="relative group/codeblock rounded-xl overflow-hidden mb-4 border border-[#2A2B32]">
                                              <div className="flex items-center justify-between px-4 py-2 bg-[#131314] text-[#A1A1A8] text-xs font-mono font-medium border-b border-[#2A2B32]">
                                                <span>{language}</span>
                                                <button
                                                  onClick={() =>
                                                    handleOpenInCanvas(
                                                      String(children).replace(
                                                        /\n$/,
                                                        ""
                                                      ),
                                                      language
                                                    )
                                                  }
                                                  className="flex items-center gap-1.5 hover:text-white transition-colors py-1 px-2 rounded-md hover:bg-[#2A2B32] opacity-0 group-hover/codeblock:opacity-100"
                                                >
                                                  <PanelRight className="w-3.5 h-3.5" />
                                                  <span>Open in Canvas</span>
                                                </button>
                                              </div>
                                              <SyntaxHighlighter
                                                {...props}
                                                style={{}}
                                                language={match[1]}
                                                PreTag="div"
                                                className="!m-0 !bg-[#1E1F22] p-4 text-[#E3E3E8] font-mono text-xs overflow-x-auto leading-relaxed"
                                              >
                                                {String(children).replace(
                                                  /\n$/,
                                                  ""
                                                )}
                                              </SyntaxHighlighter>
                                            </div>
                                          );
                                        }
                                        return (
                                          <code {...props} className={className}>
                                            {children}
                                          </code>
                                        );
                                      },
                                    }}
                                  >
                                    {m.content}
                                  </ReactMarkdown>

                                  {m.intentConfidence !== undefined && m.targetTool && (
                                    <div className="mt-4 bg-[#1E1F22] border border-[#2A2B32] p-3 rounded-xl max-w-sm shadow-sm relative overflow-hidden group">
                                       <div className="flex justify-between items-center mb-1.5 text-xs relative z-10">
                                          <span className="text-[#A1A1A8] font-medium flex items-center gap-1.5">
                                            <Hexagon className="w-3.5 h-3.5 text-indigo-400 animate-spin" /> Node Agent: <span className="text-white font-mono">{m.targetTool}</span>
                                          </span>
                                          <span className={cn("font-bold font-mono", m.intentConfidence >= 0.8 ? "text-green-400" : m.intentConfidence >= 0.5 ? "text-yellow-400" : "text-red-400")}>
                                            {(m.intentConfidence * 100).toFixed(0)}% Match
                                          </span>
                                       </div>
                                       <div className="w-full bg-[#131314] rounded-full h-1.5 overflow-hidden relative z-10 border border-[#2a2b30]">
                                          <div 
                                            className={cn("h-full rounded-full transition-all duration-1000 ease-out", m.intentConfidence >= 0.8 ? "bg-green-400" : m.intentConfidence >= 0.5 ? "bg-yellow-400" : "bg-red-400")}
                                            style={{ width: `${Math.min(100, Math.max(0, m.intentConfidence * 100))}%` }}
                                          />
                                       </div>
                                       <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  )}

                                  {m.groundingSources && m.groundingSources.length > 0 && (
                                    <div className="mt-6">
                                      <h4 className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-3 flex items-center gap-2 border-none">
                                        <Activity className="w-3.5 h-3.5 text-indigo-400" /> Grounded Evidences (NotebookLM)
                                      </h4>
                                      <div className="flex flex-row gap-3 overflow-x-auto pb-2 android-scroll pr-4">
                                        {m.groundingSources.map(
                                          (source: { title?: string; source?: string; snippet?: string }, idx: number) => (
                                            <div
                                              key={idx}
                                              className="bg-[#1e1e21] border border-[#2a2b30] p-3 rounded-xl min-w-[245px] max-w-[310px] shrink-0 hover:border-indigo-500/60 transition-all cursor-pointer shadow-sm group"
                                            >
                                              <div className="text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wider group-hover:text-indigo-300">
                                                {source.source}
                                              </div>
                                              <div className="text-[13px] text-white font-medium truncate mb-1">
                                                {source.title}
                                              </div>
                                              <div className="text-[12px] text-[#8e8e93] line-clamp-2 leading-relaxed">
                                                {source.snippet}
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );})}
                        {isTyping && (
                          <div className="flex w-full justify-start items-center gap-3 ml-2.5 animate-pulse">
                            <Hexagon className="w-5 h-5 text-indigo-400 animate-spin" />
                            <span className="text-xs text-[#8e8e93] font-mono">Routing agentic workflow gates...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-prompt input area inside active chats */}
                {(currentThreadId !== null || messages.length > 0) && (
                  <div className="p-4 bg-[#131314] shrink-0 w-full z-10 border-t border-[#262629]/30">
                    <div className="max-w-[850px] mx-auto w-full relative">
                      {/* Connector trigger dialog */}
                      {showExtensions && (
                        <div className="absolute bottom-full mb-3 w-[260px] bg-[#1e1e21] border border-[#2a2b30] rounded-2xl shadow-2xl overflow-hidden p-2 z-50 animate-fade-in">
                          <div className="mb-2 px-2 pt-1 text-xs font-bold text-[#8e8e93] uppercase tracking-wider">
                            Available Connectors
                          </div>
                          {extensions.map((ext, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setInput(
                                  (prev) =>
                                    prev.replace(/@\w*$/, "") +
                                    "@" +
                                    ext.name +
                                    " "
                                );
                                setShowExtensions(false);
                                textareaRef.current?.focus();
                              }}
                              className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-[#2c2d30] text-xs text-[#c4c4ca] hover:text-white font-semibold text-left transition-colors"
                            >
                              <div className="w-7 h-7 rounded-lg bg-[#18191b] flex items-center justify-center shrink-0 border border-[#2a2b30] shadow-sm">
                                <span className="text-indigo-400 text-xs font-mono font-bold">
                                  {ext.icon}
                                </span>
                              </div>
                              <span>{ext.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center mb-2 px-2">
                         <button
                            onClick={toggleReasoningMode}
                            className={cn(
                               "text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors border",
                               currentThread?.reasoningMode === 'deep' 
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm font-semibold' 
                                  : 'bg-[#1a1a1c] text-[#8e8e93] border-[#262629] hover:bg-[#222225] hover:text-white'
                            )}
                            title="Toggle Deep Reasoning Mode"
                         >
                            <Hexagon className={cn("w-3.5 h-3.5", currentThread?.reasoningMode === 'deep' && 'animate-pulse')} />
                            {currentThread?.reasoningMode === 'deep' ? 'Deep Reason Mode' : 'Fast Response'}
                         </button>
                         <button
                           onClick={() => {
                             setCurrentThreadId(null);
                             setInput("");
                           }}
                           className="text-xs text-[#8e8e93] hover:text-white transition-colors bg-[#1a1a1c] border border-[#262629] px-3 py-1.5 rounded-full hover:bg-[#222225]"
                         >
                           + New Prompt Lander
                         </button>
                      </div>

                      <div className="mb-2 rounded-2xl border border-[#262629] bg-[#1a1a1c] px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 mr-1">
                            <Sparkles className="w-3.5 h-3.5 text-[#4da1fe]" />
                            <span className="text-xs font-semibold text-[#c4c4ca]">Output Forge</span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border",
                              outputForgeStatus === "Validated" && "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
                              outputForgeStatus === "Grounded" && "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
                              outputForgeStatus === "Needs review" && "text-amber-300 border-amber-500/30 bg-amber-500/10",
                              outputForgeStatus === "Draft" && "text-[#8e8e93] border-[#2a2b30] bg-[#131314]"
                            )}>
                              {outputStatusLabel[outputForgeStatus]}
                            </span>
                          </div>
                          {outputForgeTypes.map((item) => (
                            <button
                              key={item.type}
                              onClick={() => handleOutputForgeType(item.type)}
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                outputForgeType === item.type
                                  ? "bg-[#4da1fe]/10 text-[#8ec5ff] border-[#4da1fe]/30"
                                  : "bg-[#131314] text-[#8e8e93] border-[#262629] hover:text-white hover:bg-[#222225]"
                              )}
                            >
                              {item.type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Main compact chat input bar */}
                      <div className="flex bg-[#1e1e21] rounded-3xl px-2 py-1.5 items-end border border-[#2a2b30] focus-within:border-[#3b3c43] transition-colors shadow-inner">
                        <button
                          onClick={() => handlePillClick("Add local asset vectors or supabase schema mapping specs")}
                          title="Attach document/schema"
                          className="p-3 text-[#8e8e93] hover:bg-[#2c2d30] hover:text-white rounded-full shrink-0 mb-0.5 transition-colors"
                        >
                          <Paperclip className="w-4.5 h-4.5" />
                        </button>
                        <div className="flex-1 w-full max-h-[140px] overflow-y-auto android-scroll">
                          <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                            placeholder="Instruct WidgeTDC or type @ to insert a platform connector"
                            className="w-full bg-transparent resize-none outline-none py-2.5 px-2 text-[14px] font-normal leading-relaxed placeholder:text-[#8e8e93] text-white"
                            rows={1}
                            style={{ minHeight: "38px" }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mb-0.5 px-2">
                          {input.length === 0 ? (
                            <>
                              <button
                                onClick={() => handlePillClick("Evaluate speechSynthesis pipelines under the test engine.")}
                                title="Use synthesizer input"
                                className="p-2.5 text-[#8e8e93] hover:bg-[#2c2d30] hover:text-white rounded-full transition-colors"
                              >
                                <Mic className="w-4.5 h-4.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleSend()}
                              className="p-2.5 bg-white text-[#131314] hover:bg-neutral-200 rounded-full transition-colors shadow-sm cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 ml-0.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-center text-[10px] text-[#8e8e93] mt-3 font-normal tracking-wide">
                        ArchitectGPT WidgeTDC routes are verified with local telemetry outputs on the active BFF port.
                      </p>
                    </div>
                  </div>
                )}
                </div>
                </Panel>
              )}

              {/* Side Canvas Area */}
              {isCanvasOpen && (
                <>
                  {useResizableWorkspace && (
                    <Separator className="group/resize flex w-2 shrink-0 items-center justify-center bg-[#131314] outline-none transition-colors hover:bg-[#202126] focus-visible:bg-[#202126]">
                      <div className="h-12 w-[3px] rounded-full bg-[#34363d] transition-colors group-hover/resize:bg-[#4da1fe]" />
                    </Separator>
                  )}
                  <Panel
                    id="canvas-workspace"
                    defaultSize={useResizableWorkspace ? "64%" : "100%"}
                    minSize={useResizableWorkspace ? "420px" : "100%"}
                    className="min-w-0"
                  >
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
                  </Panel>
                </>
              )}
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}
