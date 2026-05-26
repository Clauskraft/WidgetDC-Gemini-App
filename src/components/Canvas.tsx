import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Play,
  Code2,
  Maximize2,
  Minimize2,
  Wand2,
  Search,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";
import "prismjs/themes/prism-twilight.css"; // Dark theme
import { cn } from "@/src/lib/utils";
import ReactMarkdown from "react-markdown";

interface CanvasProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onChange: (newContent: string) => void;
  title?: string;
  language?: string;
}

export function Canvas({
  isOpen,
  onClose,
  content,
  onChange,
  title = "Artifact",
  language = "markdown",
}: CanvasProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContent = content
    .split("\n")
    .map((line, index) => ({ line, originalIndex: index + 1 }))
    .filter(({ line }) =>
      line.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setShowToast(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setShowToast(false), 2500);
  };

  const handleFormat = () => {
    try {
      if (language === "json") {
        onChange(JSON.stringify(JSON.parse(content), null, 2));
        return;
      }
      let indentLevel = 0;
      const lines = content.split("\n");
      const formatted = lines.map((line) => {
        let trimmed = line.trim();
        if (!trimmed) return "";

        // Decrease indent for closing braces/brackets
        if (trimmed.match(/^(\}|\]|\)<\/?|<\/)/)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const res = "  ".repeat(indentLevel) + trimmed;

        // Increase indent for opening braces/brackets or unclosed tags
        if (trimmed.match(/(\{|\[|\(|<[a-zA-Z0-9]+[^>]*[^/]>)$/)) {
          indentLevel++;
        }
        return res;
      });
      onChange(formatted.join("\n"));
    } catch (e) {
      console.error("Format failed", e);
    }
  };

  const highlight = (code: string) => {
    const lang = Prism.languages[language] ? language : "javascript";
    return Prism.highlight(code, Prism.languages[lang], lang);
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[#1E1F22] transition-all duration-300 ease-in-out z-20 overflow-hidden relative",
        isFullscreen
          ? "fixed inset-0 w-full h-full z-50"
          : isOpen
            ? "w-full md:w-[500px] lg:w-[600px] xl:w-[700px] h-full shrink-0 border-l border-[#2A2B32]/30 shadow-2xl"
            : "w-0 border-transparent border-l-0",
      )}
    >
      <div className="w-full flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col border-b border-[#2A2B32]/50 shrink-0 bg-[#131416]">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2A2B32] flex items-center justify-center">
                <Code2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[#E3E3E8]">{title}</h3>
                <div className="text-xs text-[#A1A1A8] font-mono">
                  {language}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="bg-[#2A2B32] flex items-center rounded-md p-1 mr-2">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    activeTab === "preview"
                      ? "bg-[#3B3C44] text-[#E3E3E8] shadow-sm"
                      : "text-[#A1A1A8] hover:text-[#E3E3E8]",
                  )}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab("edit")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    activeTab === "edit"
                      ? "bg-[#3B3C44] text-[#E3E3E8] shadow-sm"
                      : "text-[#A1A1A8] hover:text-[#E3E3E8]",
                  )}
                >
                  Code
                </button>
              </div>
              {activeTab === "edit" && (
                <button
                  onClick={handleFormat}
                  className="p-1.5 hover:bg-[#2A2B32] rounded-md transition-colors text-[#A1A1A8]"
                  title="Format Code"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleCopy}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  copied
                    ? "bg-green-500/10 text-green-400 scale-110"
                    : "hover:bg-[#2A2B32] text-[#A1A1A8] hover:text-[#E3E3E8]",
                )}
                title="Copy"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 hover:bg-[#2A2B32] rounded-md transition-colors text-[#A1A1A8]"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#2A2B32] rounded-md transition-colors text-[#A1A1A8]"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {(activeTab === "edit" ||
            (language !== "markdown" &&
              language !== "html" &&
              activeTab === "preview")) && (
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1A8]" />
                <input
                  type="text"
                  placeholder="Search code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#2A2B32] rounded-md py-1.5 pl-9 pr-3 text-sm text-[#E3E3E8] focus:outline-none focus:border-[#3B3C44] placeholder:text-[#5B5D66]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        <div
          className={cn(
            "absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1E1F22] border border-[#2A2B32] text-[#E3E3E8] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 ease-out",
            showToast
              ? "opacity-100 transform-none"
              : "opacity-0 -translate-y-4 pointer-events-none",
          )}
        >
          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-green-400" />
          </div>
          <span className="text-sm font-medium tracking-wide">
            Synced to Clipboard
          </span>
        </div>

        {/* Editor / Preview Area */}
        <div className="flex-1 overflow-auto bg-[#131416] w-full h-full relative">
          {searchQuery ? (
            <div className="min-h-full font-mono text-[13px] leading-relaxed p-6">
              {filteredContent.length > 0 ? (
                filteredContent.map(({ line, originalIndex }) => (
                  <div
                    key={originalIndex}
                    className="flex gap-4 hover:bg-[#1E1F22] px-2 py-1 -mx-2 rounded"
                  >
                    <span className="text-[#5B5D66] shrink-0 select-none w-6 text-right">
                      {originalIndex}
                    </span>
                    <span
                      className="text-[#E3E3E8] break-all whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: highlight(line) }}
                    />
                  </div>
                ))
              ) : (
                <div className="text-[#A1A1A8] text-center mt-10">
                  No matches found for "{searchQuery}"
                </div>
              )}
            </div>
          ) : activeTab === "edit" ||
            (language !== "markdown" &&
              language !== "html" &&
              activeTab === "preview") ? (
            <div className="min-h-full font-mono text-[13px] leading-relaxed">
              <Editor
                value={content}
                onValueChange={onChange}
                highlight={highlight}
                padding={24}
                style={{
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                  theme: "vs-dark",
                  outline: "none",
                  minHeight: "100%",
                }}
                className="editor-container text-[#E3E3E8]"
                textareaClassName="focus:outline-none"
              />
            </div>
          ) : language === "html" && activeTab === "preview" ? (
            <div className="w-full h-full bg-white">
              <iframe
                srcDoc={content}
                title="HTML Preview"
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>
          ) : (
            <div className="p-6 md:p-8 markdown-body min-h-full bg-white text-black dark:bg-[#1E1F22] dark:text-[#E3E3E8]">
              {/* Gemini style preview is often a clean document surface */}
              <div className="max-w-3xl mx-auto">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
