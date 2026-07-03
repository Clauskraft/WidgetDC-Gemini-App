import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AppWindow,
  BookOpen,
  Boxes,
  BrainCircuit,
  ChevronRight,
  FileText,
  GitBranch,
  MessageSquarePlus,
  Network,
  PanelLeft,
  Radar,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useThreads, newId } from "@/hooks/useThreads";
import { cn } from "@/lib/utils";

const libraryLinks = [
  { to: "/capabilities", label: "Capabilities", icon: GitBranch },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/engagements", label: "Engagements", icon: Boxes },
  { to: "/deliverable", label: "Deliverables", icon: FileText },
  { to: "/patterns", label: "Patterns", icon: BookOpen },
] as const;

export function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { threads, hydrated, deleteThread } = useThreads();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const active = params.threadId;

  const startNew = () => {
    const id = newId();
    navigate({
      to: "/c/$threadId",
      params: { threadId: id },
      search: { prompt: undefined as string | undefined },
    });
  };

  const navLinkBase =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground";
  const navLinkActive = "bg-sidebar-accent text-foreground";

  return (
    <aside
      className={cn(
        "app-sidebar flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-[272px]",
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">WDC Agent Office</div>
            <div className="text-[11px] text-muted-foreground">clauskraft@gmail.com</div>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={startNew}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-[0.99]",
            collapsed && "px-2",
          )}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New work</span>}
        </button>
      </div>

      <nav className="space-y-1 px-2">
        <Link to="/" className={navLinkBase} activeProps={{ className: navLinkActive }}>
          <BrainCircuit className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Chat</span>}
        </Link>
        <a href="#agent-office-canvas" className={navLinkBase}>
          <AppWindow className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Canvas</span>}
        </a>
        <Link
          to="/observability"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Radar className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Work</span>}
        </Link>
      </nav>

      {!collapsed && (
        <div className="mt-5 px-2">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
            Library
          </div>
          <div className="space-y-1">
            {libraryLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navLinkBase}
                  activeProps={{ className: navLinkActive }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-40" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="mt-5 flex-1 overflow-y-auto px-2 pb-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
            Recent
          </div>
          {hydrated && threads.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground/60">Ingen samtaler endnu.</p>
          )}
          <ul className="space-y-0.5">
            {threads.map((thread) => (
              <li key={thread.id} className="group relative">
                <Link
                  to="/c/$threadId"
                  params={{ threadId: thread.id }}
                  search={{ prompt: undefined }}
                  className={cn(
                    "block truncate rounded-lg px-3 py-2 pr-9 text-sm transition",
                    active === thread.id
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                  )}
                >
                  {thread.title || "Ny samtale"}
                </Link>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    if (confirm("Slet denne samtale?")) {
                      deleteThread(thread.id);
                      if (active === thread.id) navigate({ to: "/" });
                    }
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Slet samtale"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-sidebar-border px-2 py-2">
        <Link to="/settings" className={navLinkBase} activeProps={{ className: navLinkActive }}>
          <SettingsIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
            <PanelLeft className="h-3.5 w-3.5" />
            Scope M
          </div>
        )}
      </div>
    </aside>
  );
}
