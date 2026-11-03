import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronRight, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { dedupeRecentThreads, useThreads, newId } from "@/hooks/useThreads";
import { FOOTER_NAV, LIBRARY_NAV, PRIMARY_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "wdc-agent-office-sidebar-width";
const SIDEBAR_MIN_WIDTH = 228;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 296;
const RECENT_THREAD_LIMIT = 8;

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

export function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { threads, hydrated, deleteThread } = useThreads();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const active = params.threadId;
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const recentThreads = useMemo(() => dedupeRecentThreads(threads, active), [threads, active]);
  const visibleRecentThreads = showAllRecent
    ? recentThreads
    : recentThreads.slice(0, RECENT_THREAD_LIMIT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
    if (Number.isFinite(stored)) setSidebarWidth(clampSidebarWidth(stored));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || collapsed) return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [collapsed, sidebarWidth]);

  const startNew = () => {
    const id = newId();
    navigate({
      to: "/c/$threadId",
      params: { threadId: id },
      search: { prompt: undefined as string | undefined },
    });
  };

  const navLinkBase =
    "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground";
  const navLinkActive = "bg-sidebar-accent text-foreground";
  const sidebarStyle = {
    "--app-sidebar-width": `${collapsed ? 64 : sidebarWidth}px`,
  } as CSSProperties;

  const onSidebarResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current;
    if (!drag) return;
    setSidebarWidth(clampSidebarWidth(drag.startWidth + event.clientX - drag.startX));
  };

  const stopSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      className={cn(
        "app-sidebar flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "app-sidebar-collapsed" : "app-sidebar-expanded",
      )}
      style={sidebarStyle}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">Aurora</div>
            <div className="text-[11px] text-muted-foreground">WDC Agent Office</div>
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
          {!collapsed && <span>Ny opgave</span>}
        </button>
      </div>

      <nav className="space-y-1 px-2">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={navLinkBase}
              activeProps={{ className: navLinkActive }}
              title={`${item.label}: ${item.description}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <details className="group mt-4 px-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 transition hover:bg-sidebar-accent hover:text-foreground">
            <span>Bibliotek</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-1 space-y-1">
            {LIBRARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={navLinkBase}
                  activeProps={{ className: navLinkActive }}
                  title={`${item.label}: ${item.description}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="app-sidebar-link-copy">
                    <span>{item.label}</span>
                    <small>{item.description}</small>
                  </span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-40" />
                </Link>
              );
            })}
          </div>
        </details>
      )}

      {!collapsed && (
        <div className="mt-5 flex-1 overflow-y-auto px-2 pb-4">
          <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
            <span>Seneste</span>
            {recentThreads.length > RECENT_THREAD_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllRecent((value) => !value)}
                className="normal-case tracking-normal text-muted-foreground transition hover:text-foreground"
              >
                {showAllRecent ? "Vis færre" : `Vis alle ${recentThreads.length}`}
              </button>
            )}
          </div>
          {hydrated && recentThreads.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground/60">Ingen samtaler endnu.</p>
          )}
          <ul className="space-y-0.5">
            {visibleRecentThreads.map((thread) => (
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
        {FOOTER_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={navLinkBase}
              activeProps={{ className: navLinkActive }}
              title={`${item.label}: ${item.description}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {!collapsed && (
        <div
          className="app-sidebar-resize-handle"
          role="separator"
          aria-label="Resize left navigation sidebar"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={onSidebarResizeMove}
          onPointerUp={stopSidebarResize}
          onPointerCancel={stopSidebarResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setSidebarWidth((value) =>
                clampSidebarWidth(value + (event.key === "ArrowRight" ? 16 : -16)),
              );
            }
            if (event.key === "Home") {
              event.preventDefault();
              setSidebarWidth(SIDEBAR_MIN_WIDTH);
            }
            if (event.key === "End") {
              event.preventDefault();
              setSidebarWidth(SIDEBAR_MAX_WIDTH);
            }
          }}
        />
      )}
    </aside>
  );
}
