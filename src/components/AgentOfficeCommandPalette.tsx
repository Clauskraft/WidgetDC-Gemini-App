import { useCallback, useEffect, useMemo, useState } from "react";
import { Command, Copy, Focus, LayoutGrid, Search } from "lucide-react";
import {
  buildAgentOfficeCommands,
  type AgentOfficeCommand,
  type AgentOfficeStatusSummary,
} from "@/lib/agentOfficeStatus";
import type { WorkMode, WorkModeId } from "@/lib/workModes";
import { cn } from "@/lib/utils";

type AgentOfficeCommandPaletteProps = {
  modes: WorkMode[];
  activeModeId: WorkModeId;
  status: AgentOfficeStatusSummary;
  onSelectMode: (id: WorkModeId) => void;
  onCopyPrompt: () => void;
  defaultOpen?: boolean;
};

const actionIcon = {
  "copy-prompt": Copy,
  "focus-canvas": Focus,
  "show-wdc-objects": LayoutGrid,
} as const;

function scrollToSelector(selector: string) {
  document.querySelector(selector)?.scrollIntoView({ block: "start", behavior: "smooth" });
}

export function AgentOfficeCommandPalette({
  modes,
  activeModeId,
  status,
  onSelectMode,
  onCopyPrompt,
  defaultOpen = false,
}: AgentOfficeCommandPaletteProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const commands = useMemo(() => buildAgentOfficeCommands(modes), [modes]);
  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.detail} ${command.group}`.toLowerCase().includes(normalizedQuery),
    );
  }, [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const runCommand = useCallback(
    (command: AgentOfficeCommand) => {
      if (command.action === "select-mode") onSelectMode(command.modeId);
      if (command.action === "copy-prompt") onCopyPrompt();
      if (command.action === "focus-canvas") scrollToSelector(".canvas-workspace");
      if (command.action === "show-wdc-objects") scrollToSelector(".wdc-object-card-section");
      close();
    },
    [close, onCopyPrompt, onSelectMode],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  const groupedCommands = filteredCommands.reduce(
    (groups, command) => {
      groups[command.group].push(command);
      return groups;
    },
    { Modes: [], Actions: [] } as Record<AgentOfficeCommand["group"], AgentOfficeCommand[]>,
  );

  return (
    <div className="agent-office-command">
      <button
        type="button"
        className="agent-office-icon-button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open Agent Office command palette"
        title="Agent Office commands"
      >
        <Command className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="agent-office-command-popover"
          role="dialog"
          aria-label="Agent Office command palette"
        >
          <div className="agent-office-command-search">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Find action or mode"
            />
          </div>

          <div className="agent-office-command-status" data-state={status.overall}>
            {status.items.map((item) => (
              <span key={item.id}>
                {item.label}: {item.value}
              </span>
            ))}
          </div>

          {(["Modes", "Actions"] as const).map((group) => (
            <section key={group} className="agent-office-command-group">
              <div>{group}</div>
              {groupedCommands[group].map((command) => {
                const active = command.action === "select-mode" && command.modeId === activeModeId;
                const Icon =
                  command.action === "select-mode" ? Command : actionIcon[command.action];
                return (
                  <button
                    key={command.id}
                    type="button"
                    className={cn(
                      "agent-office-command-item",
                      active && "agent-office-command-active",
                    )}
                    onClick={() => runCommand(command)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
