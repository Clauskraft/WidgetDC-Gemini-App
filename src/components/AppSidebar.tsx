import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  MessageSquarePlus,
  Trash2,
  Sparkles,
  LayoutDashboard,
  Settings as SettingsIcon,
  Gem,
  Network,
  FileText,
  Activity,
} from "lucide-react";
import { useThreads, newId } from "@/hooks/useThreads";
import { cn } from "@/lib/utils";

export function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { threads, hydrated, deleteThread } = useThreads();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const active = params.threadId;

  const startNew = () => {
    const id = newId();
    navigate({ to: "/c/$threadId", params: { threadId: id } });
  };

  return (
    <aside className={cn("flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all", collapsed ? "w-16" : "w-72")}>
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-aurora shadow-glow">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">WidgeTDC Aurora</span>
            <span className="text-xs text-muted-foreground">Gemini-style workspace</span>
          </div>
        )}
      </div>

      <button
        onClick={startNew}
        className="mx-3 mb-3 inline-flex items-center justify-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-4 py-2.5 text-sm font-medium text-sidebar-accent-foreground transition hover:bg-accent hover:shadow-soft"
      >
        <MessageSquarePlus className="h-4 w-4" />
        {!collapsed && <span>Ny chat</span>}
      </button>

      <nav className="px-2 space-y-0.5">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <LayoutDashboard className="h-4 w-4" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
        <Link
          to="/gems"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <Gem className="h-4 w-4" />
          {!collapsed && <span>Gem-bots</span>}
        </Link>
        <Link
          to="/graph"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <Network className="h-4 w-4" />
          {!collapsed && <span>Graph</span>}
        </Link>
        <Link
          to="/deliverable"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <FileText className="h-4 w-4" />
          {!collapsed && <span>Deliverables</span>}
        </Link>
        <Link
          to="/observability"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <Activity className="h-4 w-4" />
          {!collapsed && <span>Observability</span>}
        </Link>
      </nav>

      {!collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
          <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Seneste</div>
          {hydrated && threads.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground">Ingen samtaler endnu. Start en ny.</p>
          )}
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id} className="group relative">
                <Link
                  to="/c/$threadId"
                  params={{ threadId: t.id }}
                  className={cn(
                    "block truncate rounded-lg px-3 py-2 pr-9 text-sm transition",
                    active === t.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {t.title || "Ny samtale"}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Slet denne samtale?")) {
                      deleteThread(t.id);
                      if (active === t.id) navigate({ to: "/" });
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

      <div className="border-t border-sidebar-border px-2 py-3">
        <Link
          to="/settings"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        >
          <SettingsIcon className="h-4 w-4" />
          {!collapsed && <span>Indstillinger</span>}
        </Link>
      </div>
    </aside>
  );
}
