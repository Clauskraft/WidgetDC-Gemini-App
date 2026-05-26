import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, Plus, MessageSquare, Settings, HelpCircle, Activity,
  Mic, ImagePlus, Hexagon, Send, ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from '@google/genai';
import { Dashboard } from '@/src/components/Dashboard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export default function App() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const messages = threads.find(t => t.id === currentThreadId)?.messages || [];
  
  const [input, setInput] = useState('');
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    async function loadThreads() {
      try {
        const res = await fetch('/api/threads');
        if (res.ok) {
          const data = await res.json();
          if (data.threads) {
            setThreads(data.threads);
          }
        }
      } catch (e) {
        console.error("Failed to load threads from backend", e);
        // Fallback to local storage if backend is unreachable
        const saved = localStorage.getItem('widgetdc_threads');
        if (saved) setThreads(JSON.parse(saved));
      }
    }
    loadThreads();
  }, []);

  const saveThreadToBackend = async (thread: Thread) => {
    try {
      await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thread)
      });
    } catch (e) {
      console.error("Failed to sync thread to backend", e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
    // Simple @ handler
    if (e.target.value.endsWith('@')) {
      setShowExtensions(true);
    } else if (!e.target.value.includes('@')) {
      setShowExtensions(false);
    }
  };

  const updateThreadActive = (updatedThread: Thread, activeId: string) => {
    setThreads(prev => {
      const filtered = prev.filter(t => t.id !== activeId);
      const updated = [updatedThread, ...filtered].sort((a,b) => b.updatedAt - a.updatedAt);
      localStorage.setItem('widgetdc_threads', JSON.stringify(updated));
      return updated;
    });
    saveThreadToBackend(updatedThread);
  };
  
  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = input;
    setInput('');
    setShowExtensions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let activeId = currentThreadId;
    
    if (!activeId) {
      activeId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const newThread: Thread = {
        id: activeId,
        title: userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : ""),
        messages: [{ role: 'user', content: userMessage }],
        updatedAt: Date.now()
      };
      updateThreadActive(newThread, activeId);
      setCurrentThreadId(activeId);
    } else {
      const activeThread = threads.find(t => t.id === activeId);
      if (activeThread) {
        const updatedThread = {
          ...activeThread,
          messages: [...activeThread.messages, { role: 'user' as const, content: userMessage }],
          updatedAt: Date.now()
        };
        updateThreadActive(updatedThread, activeId);
      }
    }

    setIsTyping(true);

    try {
      // First try widgetdc base if intent detected as instruction, or else use Gemini / WidgeTDC
      // The user wants a Gemini app frontend to widgetdc. We will map to intent_detect or reason_deeply on WidgeTDC
      const res = await fetch('/api/widgetdc/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: "intent_detect",
          payload: { 
            query: userMessage,
            enabled_tools: input.match(/@(NotebookLM|Deep|GraphRAG|Omega)/g) || []
          }
        })
      });
      
      const data = await res.json();
      let assistantText = "";

      if (res.ok && data && !data.error) {
         if (data._simulated_tools) {
            // Because plan or intent can be complex JSON objects, let's wrap them carefully
            const body = typeof data.intent === 'string' ? data.intent : "```json\n" + (data.plan?.result?.recommendation || JSON.stringify(data, null, 2)) + "\n```";
            assistantText = `### Agentic Execution Chain\n\`\`\`text\n${data._simulated_tools}\n\`\`\`\n\n---\n\n${body}`;
         } else {
            // Standard formatting if no simulated tools
            const content = data.plan?.result?.recommendation || data.intent || JSON.stringify(data, null, 2);
            assistantText = typeof content === 'string' && !content.startsWith('{') ? content : "```json\n" + JSON.stringify(data, null, 2) + "\n```";
         }
      } else {
         assistantText = `Error from WidgeTDC: ${data.error || data._error || res.statusText || 'Unknown error'}`;
      }

      // Get the latest thread state from threads state
      setThreads(prev => {
         const activeThread = prev.find(t => t.id === activeId);
         if (!activeThread) return prev;
         const updatedThread = {
           ...activeThread,
           messages: [...activeThread.messages, { role: 'assistant', content: assistantText } as Message],
           updatedAt: Date.now()
         };
         
         const filtered = prev.filter(t => t.id !== activeId);
         const updated = [updatedThread, ...filtered].sort((a,b) => b.updatedAt - a.updatedAt);
         localStorage.setItem('widgetdc_threads', JSON.stringify(updated));
         
         // Side effect in set state is acceptable for quick sync here as it's fire and forget
         saveThreadToBackend(updatedThread);
         return updated;
      });
    } catch (e: any) {
      setThreads(prev => {
         const activeThread = prev.find(t => t.id === activeId);
         if (!activeThread) return prev;
         const updatedThread = {
           ...activeThread,
           messages: [...activeThread.messages, { role: 'assistant', content: `Error: ${e.message}` } as Message],
           updatedAt: Date.now()
         };
         const filtered = prev.filter(t => t.id !== activeId);
         const updated = [updatedThread, ...filtered].sort((a,b) => b.updatedAt - a.updatedAt);
         localStorage.setItem('widgetdc_threads', JSON.stringify(updated));
         
         saveThreadToBackend(updatedThread);
         return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const extensions = [
    { name: 'NotebookLM Grounding', icon: 'N' },
    { name: 'Deep Research Agent', icon: 'D' },
    { name: 'GraphRAG (Neo4j)', icon: 'G' },
    { name: 'Omega Sentinel Routing', icon: 'O' }
  ];

  return (
    <div className="flex h-screen bg-[#1E1F22] text-[#E3E3E8] font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar */}
      <div 
        className={cn(
          "bg-[#1E1F22] flex flex-col transition-all duration-300 ease-in-out shrink-0",
          isSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 w-[280px]">
          <button 
            onClick={() => {
              setCurrentView('chat');
              setCurrentThreadId(null);
            }}
            className={cn(
              "flex items-center gap-3 w-max hover:bg-[#2A2B32] transition-colors rounded-full px-4 py-2.5 text-sm font-medium border shadow-sm",
              currentView === 'chat' && currentThreadId === null ? "text-[#131314] bg-[#E3E3E8] border-[#E3E3E8] hover:bg-white" : "text-[#E3E3E8] bg-[#2A2B32]/50 border-transparent"
            )}
          >
            <Plus className="w-5 h-5" />
            <span>New chat</span>
          </button>
        </div>

        <div className="flex-1 w-[280px] overflow-y-auto mt-4 px-4 android-scroll">
          <p className="text-xs font-semibold px-2 text-[#A1A1A8] mb-2">Recent</p>
          <div className="space-y-1">
            {threads.map((thread) => (
              <button 
                key={thread.id} 
                onClick={() => {
                  setCurrentThreadId(thread.id);
                  setCurrentView('chat');
                }}
                className={cn(
                  "flex items-center gap-3 w-full p-2.5 rounded-xl border hover:bg-[#2A2B32] transition-colors text-sm text-left truncate",
                  currentThreadId === thread.id && currentView === 'chat'
                     ? "bg-[#2A2B32] border-[#3B3C44] text-white" 
                     : "border-transparent text-[#E3E3E8]"
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-[#A1A1A8]" />
                <span className="truncate">{thread.title}</span>
              </button>
            ))}
            {threads.length === 0 && (
              <div className="px-2 text-xs text-[#A1A1A8] italic">No recent chats</div>
            )}
          </div>
        </div>

        <div className="p-4 w-[280px] space-y-1 text-sm text-[#A1A1A8]">
          <button className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors">
            <HelpCircle className="w-5 h-5" /> Help
          </button>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors",
              currentView === 'dashboard' ? "bg-[#2A2B32] text-white font-medium" : ""
            )}
          >
            <Activity className="w-5 h-5" /> Activity
          </button>
          <button className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] transition-colors">
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-[#131314] relative rounded-tl-2xl border-l border-t border-[#2A2B32] overflow-hidden">
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
              Gemini <ChevronDown className="w-4 h-4 mt-1 text-[#A1A1A8]" />
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-[#2A2B32] shadow-sm">
            <span className="text-white font-bold text-sm">W</span>
          </div>
        </header>

        {/* Main Area */}
        {currentView === 'dashboard' ? (
          <Dashboard />
        ) : (
          <>
            {/* Chat Area */}
            <div 
              className="flex-1 overflow-y-auto px-4 md:px-0 w-full android-scroll"
              ref={scrollRef}
            >
          <div className="max-w-[850px] mx-auto w-full h-full flex flex-col pt-4 pb-32">
            {messages.length === 0 ? (
              <div className="flex flex-col flex-1 p-4 justify-center md:pt-16 md:pb-0 h-full">
                <h1 className="text-[40px] md:text-[56px] leading-tight font-medium bg-gradient-to-br from-blue-400 via-cyan-300 to-indigo-400 text-transparent bg-clip-text mb-2">
                  Hello, Architect.
                </h1>
                <h2 className="text-[40px] md:text-[56px] leading-tight font-medium text-[#444746]">
                  How can I help you govern today?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-16">
                  {[
                    { title: 'Deep Repo Reasoning', subtitle: '2M Context Window', desc: 'Scan codebases & phantom claims', prompt: 'Perform deep repository-level reasoning using 2M Context Window on WidgeTDC repo' },
                    { title: 'Native Tool Sync', subtitle: '449+ MCP Tools', desc: 'Execute platform tools directly', prompt: 'Demonstrate Native Function Calling over WidgeTDC MCP tools' },
                    { title: 'GraphRAG Process', subtitle: 'Omega Sentinel', desc: 'Neo4j reasoning synthesis', prompt: 'Execute GraphRAG mod Neo4j for Omega Sentinel process' },
                    { title: 'Multimodal Signal', subtitle: 'Pipeline Capture', desc: 'Vision and audio to Knowledge Graph', prompt: 'Run multimodal signal capture pipeline mod WidgeTDC tragten' }
                  ].map((item, i) => (
                    <button 
                      key={i} 
                      onClick={() => setInput(item.prompt)}
                      className="bg-[#1E1F22] hover:bg-[#2A2B32] p-4 h-[130px] rounded-2xl flex flex-col justify-between items-start text-left transition-colors border border-transparent shadow-sm group"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[15px] font-medium leading-snug text-[#E3E3E8] group-hover:text-white transition-colors">{item.title}</span>
                        <span className="text-[13px] font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">{item.subtitle}</span>
                        <span className="text-[12px] text-[#A1A1A8] leading-tight line-clamp-2 mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-8 w-full p-4 mb-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex w-full",
                    m.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 mr-4 mt-0.5 relative flex-shrink-0">
                         <div className="absolute inset-0 rounded-full bg-[url('https://www.gstatic.com/lamda/images/sparkle_resting_v2_darkmode_2bdb7df2724e450073ede.gif')] bg-cover bg-center" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[85%]",
                      m.role === 'user' 
                        ? "bg-[#2A2B32] text-white px-5 py-3 rounded-t-[24px] rounded-bl-[24px] rounded-br-[6px] text-[15px] font-light leading-relaxed shadow-sm" 
                        : "text-[#E3E3E8] prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1E1F22] prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:shadow-sm"
                    )}>
                      {m.role === 'user' ? (
                        m.content
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex w-full justify-start items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-[url('https://www.gstatic.com/lamda/images/sparkle_thinking_v2_darkmode_1223e75eace4cc3ccfc1c.gif')] bg-cover bg-center relative flex-shrink-0" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:px-0 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent shrink-0">
          <div className="max-w-[850px] mx-auto w-full relative">
            {showExtensions && (
               <div className="absolute bottom-full mb-3 w-[260px] bg-[#1E1F22] border border-[#2A2B32] rounded-2xl shadow-2xl overflow-hidden p-2 z-50">
                 <div className="mb-2 px-2 pt-1 text-xs font-bold text-[#A1A1A8] uppercase tracking-wider">Connectors</div>
                 {extensions.map((ext, i) => (
                   <button 
                     key={i} 
                     onClick={() => {
                       setInput(prev => prev.replace(/@\w*$/, '') + '@' + ext.name + ' ');
                       setShowExtensions(false);
                       textareaRef.current?.focus();
                     }}
                     className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-[#2A2B32] text-sm text-[#E3E3E8] font-medium text-left transition-colors"
                   >
                     <div className="w-7 h-7 rounded-lg bg-[#131314] flex items-center justify-center shrink-0 border border-[#2A2B32] shadow-sm">
                       <span className="text-[#A1A1A8] text-xs font-bold">{ext.icon}</span>
                     </div>
                     <span>{ext.name}</span>
                   </button>
                 ))}
               </div>
            )}

            <div className="flex bg-[#1E1F22] rounded-[32px] px-2 py-2 items-end border border-[#2A2B32] shadow-[0_2px_15px_rgba(0,0,0,0.2)] focus-within:bg-[#2A2B32]/80 focus-within:border-slate-600 transition-all">
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
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Gemini or type @ to select a connector"
                  className="w-full bg-transparent resize-none outline-none py-3 px-2 text-[15px] font-normal leading-relaxed placeholder:text-[#A1A1A8] text-white"
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0 mb-0.5 px-2">
                {input.length === 0 ? (
                  <>
                    <button title="Use microphone" className="p-3 text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] rounded-full transition-colors">
                      <Mic className="w-5 h-5" />
                    </button>
                    <button title="Upload image" className="p-3 text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] rounded-full transition-colors">
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
              Gemini may display inaccurate info, including about people, so double-check its responses.
            </p>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
