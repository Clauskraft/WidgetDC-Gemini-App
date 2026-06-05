import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Play,
  Code2,
  Wand2,
  Search,
  Maximize2,
  Minimize2,
  PanelRightClose,
  ZoomIn,
  ZoomOut,
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
import { Mermaid } from "@/src/components/Mermaid";

type CanvasSize = "default" | "wide" | "focus";
type CanvasLayer = "narrative" | "evidence" | "risks" | "actions";

const CANVAS_LAYERS: CanvasLayer[] = [
  "narrative",
  "evidence",
  "risks",
  "actions",
];

interface CanvasProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onChange: (newContent: string) => void;
  title?: string;
  language?: string;
  onNodeClick?: (node: { id: string; label: string }) => void;
  highlightedNode?: { id: string; label: string } | null;
  size?: CanvasSize;
  onSizeChange?: (size: CanvasSize) => void;
}

export function Canvas({
  isOpen,
  onClose,
  content,
  onChange,
  title = "Artifact",
  language = "markdown",
  onNodeClick,
  highlightedNode,
  size = "default",
  onSizeChange,
}: CanvasProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [visibleLayers, setVisibleLayers] = useState<Record<CanvasLayer, boolean>>({
    narrative: true,
    evidence: true,
    risks: true,
    actions: true,
  });
  const zoomFrameStyle = {
    width: `${100 / zoom}%`,
    minHeight: `${100 / zoom}%`,
  };
  const zoomContentStyle = {
    transform: `scale(${zoom})`,
    transformOrigin: "top left",
  };

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
        isOpen
          ? cn(
              "w-full h-full min-w-0 border-l border-[#2A2B32]/30 shadow-2xl",
              size === "default" && "lg:flex-1",
              size === "wide" && "lg:w-[70%] shrink-0",
              size === "focus" && "lg:w-full",
            )
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
              {activeTab === "preview" && language !== "mermaid" && (
                <div className="bg-[#2A2B32] flex items-center rounded-md p-1 mx-1">
                  <button
                    onClick={() =>
                      setZoom((value) =>
                        Math.max(0.75, Number((value - 0.25).toFixed(2))),
                      )
                    }
                    className="p-1 rounded-md text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] transition-colors"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="min-w-10 px-2 py-1 rounded-md text-[11px] font-medium text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] transition-colors"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={() =>
                      setZoom((value) =>
                        Math.min(1.5, Number((value + 0.25).toFixed(2))),
                      )
                    }
                    className="p-1 rounded-md text-[#A1A1A8] hover:bg-[#3B3C44] hover:text-[#E3E3E8] transition-colors"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {onSizeChange && (
                <>
                  <button
                    onClick={() =>
                      onSizeChange(size === "wide" ? "default" : "wide")
                    }
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      size === "wide"
                        ? "bg-[#2A2B32] text-[#E3E3E8]"
                        : "hover:bg-[#2A2B32] text-[#A1A1A8] hover:text-[#E3E3E8]",
                    )}
                    title={size === "wide" ? "Restore Canvas Width" : "Widen Canvas"}
                    aria-label={size === "wide" ? "Restore Canvas Width" : "Widen Canvas"}
                    aria-pressed={size === "wide"}
                  >
                    {size === "wide" ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      onSizeChange(size === "focus" ? "default" : "focus")
                    }
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      size === "focus"
                        ? "bg-[#2A2B32] text-[#E3E3E8]"
                        : "hover:bg-[#2A2B32] text-[#A1A1A8] hover:text-[#E3E3E8]",
                    )}
                    title={size === "focus" ? "Restore Workspace" : "Focus Canvas"}
                    aria-label={size === "focus" ? "Restore Workspace" : "Focus Canvas"}
                    aria-pressed={size === "focus"}
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </>
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
              language !== "mermaid" &&
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
          {activeTab === "preview" && (
            <div className="flex flex-wrap gap-2 px-3 pb-3">
              {CANVAS_LAYERS.map((layer) => (
                <button
                  key={layer}
                  onClick={() =>
                    setVisibleLayers((current) => ({
                      ...current,
                      [layer]: !current[layer],
                    }))
                  }
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-full border capitalize transition-colors",
                    visibleLayers[layer]
                      ? "text-cyan-300 border-cyan-500/30 bg-cyan-500/10"
                      : "text-[#8e8e93] border-[#2a2b30] bg-transparent",
                  )}
                  aria-pressed={visibleLayers[layer]}
                >
                  {layer}
                </button>
              ))}
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
              language !== "mermaid" &&
              activeTab === "preview") ? (
            <div className="min-h-full font-mono text-[13px] leading-relaxed">
              <Editor
                value={content}
                onValueChange={onChange}
                highlight={highlight}
                padding={24}
                style={{
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                  outline: "none",
                  minHeight: "100%",
                }}
                className="editor-container text-[#E3E3E8]"
                textareaClassName="focus:outline-none"
              />
            </div>
          ) : language === "mermaid" && activeTab === "preview" ? (
            <div className="w-full h-full bg-[#131416] overflow-hidden relative">
              <Mermaid
                chart={content}
                onNodeClick={onNodeClick}
                highlightedNode={highlightedNode}
              />
            </div>
          ) : language === "html" && activeTab === "preview" ? (
            <div className="w-full h-full bg-[#131416] p-6 overflow-auto">
              <div style={zoomFrameStyle}>
              <div
                style={zoomContentStyle}
                className="rounded-xl border border-[#2A2B32] bg-[#1E1F22] p-4 font-mono text-xs text-[#E3E3E8] whitespace-pre-wrap"
              >
                {content}
              </div>
              </div>
            </div>
          ) : (
            <div className="p-5 md:p-7 markdown-body min-h-full bg-[#131416] text-[#E3E3E8]">
              <div style={zoomFrameStyle}>
              <div
                style={zoomContentStyle}
                className="max-w-5xl mx-auto"
              >
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
