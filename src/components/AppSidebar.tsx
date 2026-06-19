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
  BookOpen,
  Briefcase,
  Calendar,
  Presentation,
  Boxes,
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

  const navLinkBase =
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground";
  const navLinkActive = "bg-sidebar-accent text-foreground";

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-[260px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate">WidgeTDC Aurora</span>
          </div>
        )}
      </div>

      {/* New chat button — primary, prominent */}
      <div className="px-3 mb-2">
        <button
          onClick={startNew}
          className={cn(
            "inline-flex w-full items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-150 hover:opacity-90 hover:shadow-glow active:scale-[0.98]",
            collapsed && "justify-center px-2",
          )}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Ny chat</span>}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="px-2 space-y-0.5">
        <Link
          to="/dashboard"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>
        <Link
          to="/gems"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Gem className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Widgets</span>}
        </Link>
        <Link
          to="/graph"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Network className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Graph</span>}
        </Link>
        <Link
          to="/monday-review"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Monday Review</span>}
        </Link>
        <Link
          to="/engagements"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Briefcase className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Engagements</span>}
        </Link>
        <Link
          to="/deliverable"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <FileText className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Deliverables</span>}
        </Link>
        <Link
          to="/observability"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Activity className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Observability</span>}
        </Link>
        <Link
          to="/patterns"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Patterns</span>}
        </Link>
        <Link
          to="/consulting"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Boxes className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Assembly BOM</span>}
        </Link>
        <Link
          to="/storyline"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <Presentation className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Storyline Builder</span>}
        </Link>
      </nav>

      {/* Recent threads */}
      {!collapsed && (
        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Seneste
          </div>
          {hydrated && threads.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground/60">
              Ingen samtaler endnu.
            </p>
          )}
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id} className="group relative">
                <Link
                  to="/c/$threadId"
                  params={{ threadId: t.id }}
                  className={cn(
                    "block truncate rounded-xl px-3 py-2 pr-9 text-sm transition-all duration-150",
                    active === t.id
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Slet samtale"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom settings */}
      <div className="border-t border-sidebar-border px-2 py-2">
        <Link
          to="/settings"
          className={navLinkBase}
          activeProps={{ className: navLinkActive }}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Indstillinger</span>}
        </Link>
      </div>
    </aside>
  );
}
