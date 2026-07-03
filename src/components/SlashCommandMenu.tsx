import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: "pattern" | "agent" | "route" | "moat";
  action: () => void;
}

const COMMANDS: SlashCommand[] = [
  // Patterns
  {
    id: "/pattern/runtime-truth",
    label: "Runtime Truth",
    description: "Verify with live data",
    category: "pattern",
    action: () => {},
  },
  {
    id: "/pattern/evidence-gated",
    label: "Evidence-Gated",
    description: "Gate claims by evidence",
    category: "pattern",
    action: () => {},
  },
  {
    id: "/pattern/canary-skeptic",
    label: "Canary Skeptic",
    description: "Challenge assumptions",
    category: "pattern",
    action: () => {},
  },
  {
    id: "/pattern/thompson-sampling",
    label: "Thompson Sampling",
    description: "Bayesian optimization",
    category: "pattern",
    action: () => {},
  },
  {
    id: "/pattern/zipfold-harvest",
    label: "ZipFold Harvest",
    description: "Negative-space learning",
    category: "pattern",
    action: () => {},
  },

  // Agents
  {
    id: "/agent/qwen",
    label: "Qwen",
    description: "Governance enforcer",
    category: "agent",
    action: () => {},
  },
  {
    id: "/agent/claude",
    label: "Claude",
    description: "Primary assistant",
    category: "agent",
    action: () => {},
  },
  {
    id: "/agent/codex",
    label: "Codex",
    description: "Code specialist",
    category: "agent",
    action: () => {},
  },
  {
    id: "/agent/gemini",
    label: "Gemini",
    description: "Creative analyst",
    category: "agent",
    action: () => {},
  },

  // Routes
  {
    id: "/route/cheapest",
    label: "Cheapest",
    description: "Tier-1 routing",
    category: "route",
    action: () => {},
  },
  {
    id: "/route/balanced",
    label: "Balanced",
    description: "Cost/quality balance",
    category: "route",
    action: () => {},
  },
  {
    id: "/route/most-accurate",
    label: "Most Accurate",
    description: "Tier-3 premium",
    category: "route",
    action: () => {},
  },
  {
    id: "/route/evidence-backed",
    label: "Evidence-Backed",
    description: "KG-grounded",
    category: "route",
    action: () => {},
  },

  // Moats
  {
    id: "/moat/qed",
    label: "Q.E.D.",
    description: "Proof display",
    category: "moat",
    action: () => {},
  },
  {
    id: "/moat/resonance",
    label: "Resonance",
    description: "Multi-provider consensus",
    category: "moat",
    action: () => {},
  },
  {
    id: "/moat/truth",
    label: "Truth Distance",
    description: "Hallucination meter",
    category: "moat",
    action: () => {},
  },
];

const CATEGORY_COLORS = {
  pattern: "text-blue-400",
  agent: "text-green-400",
  route: "text-amber-400",
  moat: "text-purple-400",
};

export function SlashCommandMenu({ onSelect }: { onSelect: (cmd: string) => void }) {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].id);
        setFilter("");
      }
      if (e.key === "Escape") {
        onSelect("");
        setFilter("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, onSelect]);

  if (!filter) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-auto">
      <div className="p-2 border-b border-zinc-700">
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value.replace(/^\//, ""))}
          placeholder="Search commands..."
          className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
          autoFocus
        />
      </div>
      {filtered.length === 0 && <div className="p-3 text-sm text-zinc-500">No commands found</div>}
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          onClick={() => {
            onSelect(cmd.id);
            setFilter("");
          }}
          className={cn(
            "w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-zinc-800 transition-colors",
            i === selectedIndex && "bg-zinc-800",
          )}
        >
          <span className={cn("text-xs font-semibold w-16", CATEGORY_COLORS[cmd.category])}>
            {cmd.category}
          </span>
          <div>
            <div className="text-sm text-white font-medium">{cmd.id}</div>
            <div className="text-xs text-zinc-500">{cmd.description}</div>
          </div>
        </button>
      ))}
      <div className="p-2 border-t border-zinc-700 text-xs text-zinc-600">
        ↑↓ navigate · Enter select · Esc close
      </div>
    </div>
  );
}
