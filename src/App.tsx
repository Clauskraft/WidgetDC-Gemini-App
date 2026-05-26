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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/src/lib/utils";
import { GoogleGenAI } from "@google/genai";
import { Dashboard } from "@/src/components/Dashboard";
import { Settings as SettingsView } from "@/src/components/Settings";
import { Canvas } from "@/src/components/Canvas";

interface Message {
  role: "user" | "assistant";
  content: string;
  groundingSources?: any[];
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

export default function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const currentThread = threads.find((t) => t.id === currentThreadId);
  const messages = currentThread?.messages || [];

  const [input, setInput] = useState("");
  const [currentView, setCurrentView] = useState<
    "chat" | "dashboard" | "settings"
  >("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Canvas State
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [canvasLanguage, setCanvasLanguage] = useState("markdown");

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

    // Only parse if it's the assistant that just replied and we aren't currently typing
    if (lastMessage.role === "assistant" && !isTyping) {
      const content = lastMessage.content;

      // Regex to find code blocks: ```language\ncontent\n```
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      let lastBlock = null;
      let lastLang = null;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        lastLang = match[1] || "markdown";
        lastBlock = match[2];
      }

      if (lastBlock) {
        // Exclude certain standard logs if we want, or just auto-open
        if (lastLang !== "text") {
          setCanvasLanguage(lastLang);
          setCanvasContent(lastBlock.trim());
          setIsCanvasOpen(true);
        }
      }
    }
  }, [messages, isTyping]);

  useEffect(() => {
    async function loadThreads() {
      try {
        const res = await fetch("/api/threads");
        if (res.ok) {
          const data = await res.json();
          if (data.threads) {
            setThreads(data.threads);
          }
        }
      } catch (e) {
        console.error("Failed to load threads from backend", e);
        // Fallback to local storage if backend is unreachable
        const saved = localStorage.getItem("widgetdc_threads");
        if (saved) setThreads(JSON.parse(saved));
      }
    }
    loadThreads();
  }, []);

  const saveThreadToBackend = async (thread: Thread) => {
    try {
      await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thread),
      });
    } catch (e) {
      console.error("Failed to sync thread to backend", e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
    // Simple @ handler
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

  const toggleReasoningMode = () => {
     if (!currentThread) return;
     const updatedThread: Thread = {
        ...currentThread,
        reasoningMode: currentThread.reasoningMode === 'deep' ? 'fast' : 'deep',
        updatedAt: Date.now()
     };
     updateThreadActive(updatedThread, currentThread.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input;
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
      // Map simple requests to WidgeTDC route
      const res = await fetch("/api/widgetdc/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "intent_detect",
          payload: {
            query: userMessage,
            enabled_tools:
              input.match(/@(NotebookLM|Deep|GraphRAG|Omega)/g) || [],
            reasoningMode: currentThread?.reasoningMode || 'fast',
          },
        }),
      });

      const data = await res.json();
      let assistantText = "";

      if (res.ok && data && !data.error) {
        if (data._simulated_tools) {
          // Because plan or intent can be complex JSON objects, let's wrap them carefully
          const body =
            typeof data.intent === "string"
              ? data.intent
              : "```json\n" +
                (data.plan?.result?.recommendation ||
                  JSON.stringify(data, null, 2)) +
                "\n```";
          assistantText = `### Agentic Execution Chain\n\`\`\`text\n${data._simulated_tools}\n\`\`\`\n\n---\n\n${body}`;
        } else if (data.result?.candidates) {
          const candidates = data.result.candidates;
          let md = `**Orchestrator Routing Analysis**\n\nQuery: *"${data.result.query}"*\n\nIdentified MCP Paths:\n\n`;
          candidates.slice(0, 5).forEach((c: any, i: number) => {
            md += `${i + 1}. **\`${c.tool}\`** (Confidence: ${c.score.toFixed(2)})\n`;
          });
          assistantText = md;
        } else {
          // Standard formatting if no simulated tools
          const content =
            data.plan?.result?.recommendation ||
            data.intent ||
            JSON.stringify(data, null, 2);
          assistantText =
            typeof content === "string" && !content.startsWith("{")
              ? content
              : "```json\n" + JSON.stringify(data, null, 2) + "\n```";
        }
      } else {
        assistantText = `Error from WidgeTDC: ${data.error || data._error || res.statusText || "Unknown error"}`;
      }

      // Get the latest thread state from threads state
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

        // Side effect in set state is acceptable for quick sync here as it's fire and forget
        saveThreadToBackend(updatedThread);
        return updated;
      });
    } catch (e: any) {
      setThreads((prev) => {
        const activeThread = prev.find((t) => t.id === activeId);
        if (!activeThread) return prev;
        const updatedThread = {
          ...activeThread,
          messages: [
            ...activeThread.messages,
            { role: "assistant", content: `Error: ${e.message}` } as Message,
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

  const extensions = [
    { name: "NotebookLM Grounding", icon: "N" },
    { name: "Deep Research Agent", icon: "D" },
    { name: "GraphRAG (Neo4j)", icon: "G" },
    { name: "Omega Sentinel Routing", icon: "O" },
  ];

  return (
    <div className="flex h-screen bg-[#1E1F22] text-[#E3E3E8] font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "bg-[#131314] flex flex-col transition-all duration-300 ease-in-out shrink-0",
          isSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden",
        )}
      >
        <div className="p-4 w-[280px]">
          <button
            onClick={() => {
              setCurrentView("chat");
              setCurrentThreadId(null);
            }}
            className={cn(
              "flex items-center gap-3 w-full hover:bg-[#2A2B32] transition-colors rounded-full px-4 py-3 text-sm font-medium",
              currentView === "chat" && currentThreadId === null
                ? "text-[#E3E3E8] bg-[#2A2B32]"
                : "text-[#A1A1A8] bg-transparent",
            )}
          >
            <Plus className="w-5 h-5" />
            <span>New chat</span>
          </button>
        </div>

        <div className="flex-1 w-[280px] overflow-y-auto mt-4 px-4 android-scroll">
          <p className="text-xs font-semibold px-2 text-[#A1A1A8] mb-2">
            Recent
          </p>
          <div className="space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setCurrentThreadId(thread.id);
                  setCurrentView("chat");
                }}
                className={cn(
                  "flex items-center gap-3 w-full p-2.5 rounded-xl border hover:bg-[#2A2B32] transition-colors text-sm text-left truncate",
                  currentThreadId === thread.id && currentView === "chat"
                    ? "bg-[#2A2B32] border-[#3B3C44] text-white"
                    : "border-transparent text-[#E3E3E8]",
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-[#A1A1A8]" />
                <span className="truncate">{thread.title}</span>
              </button>
            ))}
            {threads.length === 0 && (
              <div className="px-2 text-xs text-[#A1A1A8] italic">
                No recent chats
              </div>
            )}
          </div>
        </div>

        <div className="p-4 w-[280px] space-y-1 text-sm text-[#A1A1A8]">
          <button className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors">
            <HelpCircle className="w-5 h-5" /> Help
          </button>
          <button
            onClick={() => setCurrentView("dashboard")}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors",
              currentView === "dashboard"
                ? "bg-[#2A2B32] text-white font-medium"
                : "",
            )}
          >
            <Activity className="w-5 h-5" /> Activity
          </button>
          <button
            onClick={() => setCurrentView("settings")}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors",
              currentView === "settings"
                ? "bg-[#2A2B32] text-white font-medium"
                : "",
            )}
          >
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-[#131314] relative overflow-hidden md:rounded-tl-3xl border-l border-t border-[#2A2B32]/30 md:ml-0.5">
        {/* Top bar */}
        <header className="flex items-center justify-between p-4 px-5 relative z-10 w-full shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#2A2B32] rounded-full transition-colors text-[#A1A1A8]"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="text-xl font-medium tracking-wide flex items-center gap-1.5 cursor-pointer text-[#E3E3E8]">
              WidgeTDC <ChevronDown className="w-4 h-4 mt-1 text-[#A1A1A8]" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCanvasOpen(!isCanvasOpen)}
              className={cn(
                "p-2 hover:bg-[#2A2B32] rounded-full transition-colors",
                isCanvasOpen ? "bg-[#2A2B32] text-[#E3E3E8]" : "text-[#A1A1A8]",
              )}
              title="Toggle Canvas"
            >
              <PanelRight className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden shadow-sm">
              <span className="text-white font-bold text-sm">W</span>
            </div>
          </div>
        </header>

        {/* Main Area */}
        {currentView === "dashboard" ? (
          <Dashboard />
        ) : currentView === "settings" ? (
          <SettingsView />
        ) : (
          <div className="flex-1 flex overflow-hidden w-full h-[calc(100%-80px)]">
            <div className="flex-1 flex flex-col h-full relative">
              {/* Chat Area */}
              <div
                className="flex-1 overflow-y-auto px-4 md:px-0 w-full android-scroll relative"
                ref={scrollRef}
              >
                <div className="max-w-[850px] mx-auto w-full h-full flex flex-col pt-4 pb-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col flex-1 p-4 justify-center md:pt-16 md:pb-0 h-full">
                      <h1 className="text-[40px] md:text-[56px] leading-tight font-medium bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-2 tracking-tight">
                        Hello, Architect.
                      </h1>
                      <h2 className="text-[40px] md:text-[56px] leading-tight font-medium text-[#A1A1A8] tracking-tight">
                        How can I help you?
                      </h2>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-8 w-full p-4 mb-4">
                      {messages.map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex w-full",
                            m.role === "user" ? "justify-end" : "justify-start",
                          )}
                        >
                          {m.role === "assistant" && (
                            <div className="w-7 h-7 mr-4 mt-0.5 relative flex-shrink-0 flex items-center justify-center bg-indigo-500/10 rounded-full border border-indigo-500/20">
                              <Hexagon className="w-4 h-4 text-indigo-400" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[85%]",
                              m.role === "user"
                                ? "bg-[#2A2B32] text-white px-5 py-3 rounded-t-[24px] rounded-bl-[24px] rounded-br-[6px] text-[15px] font-light leading-relaxed shadow-sm"
                                : "text-[#E3E3E8] prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1E1F22] prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:shadow-sm",
                            )}
                          >
                            {m.role === "user" ? (
                              m.content
                            ) : (
                              <div className="markdown-body w-full">
                                <ReactMarkdown
                                  components={{
                                    code({
                                      node,
                                      inline,
                                      className,
                                      children,
                                      ...props
                                    }: any) {
                                      const match = /language-(\w+)/.exec(
                                        className || "",
                                      );
                                      const language = match
                                        ? match[1]
                                        : "text";
                                      if (!inline && match) {
                                        return (
                                          <div className="relative group/codeblock rounded-xl overflow-hidden mb-4 border border-[#2A2B32]">
                                            <div className="flex items-center justify-between px-4 py-2 bg-[#131314] text-[#A1A1A8] text-xs font-mono font-medium border-b border-[#2A2B32]">
                                              <span>{language}</span>
                                              <button
                                                onClick={() =>
                                                  handleOpenInCanvas(
                                                    String(children).replace(
                                                      /\n$/,
                                                      "",
                                                    ),
                                                    language,
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
                                              style={vscDarkPlus}
                                              language={match[1]}
                                              PreTag="div"
                                              className="!m-0 !bg-[#1E1F22]"
                                            >
                                              {String(children).replace(
                                                /\n$/,
                                                "",
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
                                          <Hexagon className="w-3.5 h-3.5 text-indigo-400" /> Selected Agent: <span className="text-[#E3E3E8]">{m.targetTool}</span>
                                        </span>
                                        <span className={cn("font-bold", m.intentConfidence >= 0.8 ? "text-green-400" : m.intentConfidence >= 0.5 ? "text-yellow-400" : "text-red-400")}>
                                          {(m.intentConfidence * 100).toFixed(0)}%
                                        </span>
                                     </div>
                                     <div className="w-full bg-[#131314] rounded-full h-1.5 overflow-hidden relative z-10">
                                        <div 
                                          className={cn("h-full rounded-full transition-all duration-1000 ease-out", m.intentConfidence >= 0.8 ? "bg-green-400" : m.intentConfidence >= 0.5 ? "bg-yellow-400" : "bg-red-400")}
                                          style={{ width: `${Math.min(100, Math.max(0, m.intentConfidence * 100))}%` }}
                                        />
                                     </div>
                                     <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                )}

                                {m.groundingSources &&
                                  m.groundingSources.length > 0 && (
                                    <div className="mt-6">
                                      <h4 className="text-xs font-semibold text-[#A1A1A8] uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5" />{" "}
                                        Grounded Evidence
                                      </h4>
                                      <div className="flex flex-row gap-3 overflow-x-auto pb-2 android-scroll">
                                        {m.groundingSources.map(
                                          (source: any, idx: number) => (
                                            <div
                                              key={idx}
                                              className="bg-[#1E1F22] border border-[#2A2B32] p-3 rounded-xl min-w-[240px] max-w-[300px] shrink-0 hover:border-[#3B3C44] transition-all cursor-pointer shadow-sm group"
                                            >
                                              <div className="text-[11px] font-bold text-indigo-400 mb-1 uppercase tracking-wider group-hover:text-indigo-300">
                                                {source.source}
                                              </div>
                                              <div className="text-[13px] text-[#E3E3E8] font-medium truncate mb-1">
                                                {source.title}
                                              </div>
                                              <div className="text-[12px] text-[#A1A1A8] line-clamp-2 leading-relaxed">
                                                {source.snippet}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex w-full justify-start items-center gap-3 ml-1.5">
                          <Hexagon className="w-5 h-5 text-indigo-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 md:px-0 bg-[#131314] shrink-0 w-full z-10 border-t border-transparent">
                <div className="max-w-[850px] mx-auto w-full relative">
                  {showExtensions && (
                    <div className="absolute bottom-full mb-3 w-[260px] bg-[#1E1F22] border border-[#2A2B32] rounded-2xl shadow-2xl overflow-hidden p-2 z-50">
                      <div className="mb-2 px-2 pt-1 text-xs font-bold text-[#A1A1A8] uppercase tracking-wider">
                        Connectors
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
                                " ",
                            );
                            setShowExtensions(false);
                            textareaRef.current?.focus();
                          }}
                          className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] text-sm text-[#E3E3E8] font-medium text-left transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#131314] flex items-center justify-center shrink-0 border border-[#2A2B32] shadow-sm">
                            <span className="text-[#A1A1A8] text-xs font-bold">
                              {ext.icon}
                            </span>
                          </div>
                          <span>{ext.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end mb-2 px-2">
                     <button
                        onClick={toggleReasoningMode}
                        className={cn(
                           "text-xs px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors border",
                           currentThread?.reasoningMode === 'deep' 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-sm' 
                              : 'bg-[#1E1F22] text-[#A1A1A8] border-[#2A2B32] hover:bg-[#2A2B32]'
                        )}
                        title="Toggle Deep Reasoning"
                     >
                        <Hexagon className={cn("w-3.5 h-3.5", currentThread?.reasoningMode === 'deep' && 'animate-pulse')} />
                        {currentThread?.reasoningMode === 'deep' ? 'Reason Deeply' : 'Fast Response'}
                     </button>
                  </div>
                  <div className="flex bg-[#1E1F22] rounded-[32px] px-2 py-2 items-end border-none focus-within:bg-[#2A2B32] transition-colors">
                    <button
                      title="Upload file"
                      className="p-3 text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-white rounded-full shrink-0 mb-0.5 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 w-full max-h-[200px] overflow-y-auto android-scroll">
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
                        placeholder="Ask WidgeTDC or type @ to select a connector"
                        className="w-full bg-transparent resize-none outline-none py-3 px-2 text-[15px] font-normal leading-relaxed placeholder:text-[#A1A1A8] text-white"
                        rows={1}
                        style={{ minHeight: "44px" }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mb-0.5 px-2">
                      {input.length === 0 ? (
                        <>
                          <button
                            title="Use microphone"
                            className="p-3 text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] rounded-full transition-colors"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                          <button
                            title="Upload image"
                            className="p-3 text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] rounded-full transition-colors"
                          >
                            <ImagePlus className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleSend}
                          className="p-3 bg-[#E3E3E8] text-[#131314] hover:bg-white rounded-full transition-colors shadow-sm"
                        >
                          <Send className="w-4 h-4 ml-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-[11px] text-[#A1A1A8] mt-4 font-light mix-blend-screen opacity-80">
                    WidgeTDC may display inaccurate info, including about
                    people, so double-check its responses.
                  </p>
                </div>
              </div>
            </div>

            {/* Canvas Area */}
            <Canvas
              isOpen={isCanvasOpen}
              onClose={() => setIsCanvasOpen(false)}
              content={canvasContent}
              onChange={setCanvasContent}
              language={canvasLanguage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
