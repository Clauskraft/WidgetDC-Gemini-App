import { createFileRoute, Link } from "@tanstack/react-router";
import { GEMS } from "@/lib/gems";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/AppShell/PageShell";

export const Route = createFileRoute("/gems/")({
  head: () => ({
    meta: [
      { title: "Widgets · WidgeTDC Aurora" },
      {
        name: "description",
        content: "Forudkonfigurerede AI-eksperter til consulting, cyber, LEGO factory og OSINT.",
      },
    ],
  }),
  component: WidgetsRoute,
});

function WidgetsRoute() {
  return (
    <PageShell
      title="Widgets"
      subtitle="Forudkonfigurerede eksperter med dedikeret system-prompt, framework-stak og starter-prompts. Vælg en widget for at åbne en samtale i den rolle."
      icon={<Sparkles className="h-4 w-4 text-white" />}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {GEMS.map((g) => {
          const Icon = g.icon;
          return (
            <Link
              key={g.id}
              to="/gems/$gemId"
              params={{ gemId: g.id }}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-glow"
            >
              <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", g.accent)} />
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br shadow-soft",
                    g.accent,
                  )}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-card-foreground">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.tagline}</div>
                </div>
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">{g.description}</p>
              {Boolean(g.patterns?.length || g.dataSurfaces?.length) && (
                <div className="grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  {g.patterns?.length ? (
                    <div>
                      <div className="mb-1 font-medium text-card-foreground">Patterns</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.patterns.slice(0, 3).map((p) => (
                          <span
                            key={p.title}
                            title={p.summary}
                            className="rounded-full border border-border bg-background/60 px-2 py-0.5"
                          >
                            {p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {g.dataSurfaces?.length ? (
                    <div>
                      <div className="mb-1 font-medium text-card-foreground">Dataflader</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.dataSurfaces.slice(0, 3).map((s) => (
                          <span
                            key={s.title}
                            title={s.examples.join(", ")}
                            className="rounded-full border border-border bg-background/60 px-2 py-0.5"
                          >
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.starters.slice(0, 3).map((s) => (
                  <span
                    key={s.title}
                    className="rounded-full border border-border bg-accent/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
