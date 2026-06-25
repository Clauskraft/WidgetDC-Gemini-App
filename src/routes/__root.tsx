import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Briefcase, ChevronDown, X } from "lucide-react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { AppSidebar } from "../components/AppSidebar";
import { CommandPalette } from "../components/CommandPalette";
import {
  ActiveEngagementContext,
  ActiveEngagementProvider,
  useActiveEngagement,
} from "../lib/engagement-context";
import type { EngagementRow } from "./api/engagements";

export { ActiveEngagementContext, useActiveEngagement };

// ─── Engagement Context Bar ───────────────────────────────────────────────────
// Shown at the top of main content when an engagement is active.
// Includes a picker to switch engagement without navigating to /engagements.

function EngagementContextBar() {
  const { activeEngagement, setActiveEngagement } = useActiveEngagement();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(false);

  const openPicker = async () => {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setPickerOpen(true);
    if (engagements.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/engagements?limit=20");
      const data = (await res.json()) as { engagements?: EngagementRow[] };
      setEngagements(data.engagements ?? []);
    } catch {
      // best-effort: leave the engagement list empty if the fetch fails
    }
    setLoading(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const bar = document.getElementById("aurora-engagement-bar");
      if (bar && !bar.contains(e.target as Node)) setPickerOpen(false);
    };
    if (pickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  return (
    <div
      id="aurora-engagement-bar"
      className="relative z-20 border-b border-border bg-sidebar/60 backdrop-blur-sm"
    >
      <div className="flex h-9 items-center gap-2 px-4">
        <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <button
          onClick={openPicker}
          className="flex flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground transition hover:text-foreground"
        >
          {activeEngagement ? (
            <>
              <span className="font-medium text-foreground">{activeEngagement.name}</span>
              {activeEngagement.client && (
                <span className="text-muted-foreground">· {activeEngagement.client}</span>
              )}
              {activeEngagement.domain && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {activeEngagement.domain}
                </span>
              )}
            </>
          ) : (
            <span className="italic">Intet aktivt engagement — klik for at vælge</span>
          )}
          <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
        </button>

        {activeEngagement && (
          <button
            onClick={() => setActiveEngagement(null)}
            className="ml-1 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
            title="Ryd aktivt engagement"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-border bg-popover shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Henter engagements…</div>
          ) : engagements.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Ingen engagements fundet</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {engagements.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      setActiveEngagement(e);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-accent"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Briefcase className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{e.name}</div>
                      {e.client && (
                        <div className="truncate text-xs text-muted-foreground">{e.client}</div>
                      )}
                    </div>
                    {e.domain && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        {e.domain}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Side ikke fundet</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Noget gik galt</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Prøv igen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Til forsiden
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WidgeTDC Aurora — Gemini-style workspace" },
      {
        name: "description",
        content: "AI workspace med chat, canvas og governance — drevet af WidgeTDC-platformen.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    document.documentElement.dataset.appHydrated = "true";
    return () => {
      delete document.documentElement.dataset.appHydrated;
    };
  }, []);

  // Recovery for Vite optimized-deps chunk-fetch races.
  useEffect(() => {
    const onPreloadError = (e: Event) => {
      console.warn("[vite:preloadError] reloader app for at hente nyt chunk", e);
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ActiveEngagementProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <EngagementContextBar />
            <main className="flex flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
          <CommandPalette />
        </div>
      </ActiveEngagementProvider>
    </QueryClientProvider>
  );
}
