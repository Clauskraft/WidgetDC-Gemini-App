import { createFileRoute, Link } from "@tanstack/react-router";
import { GEMS } from "@/lib/gems";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-aurora shadow-glow">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="bg-gradient-aurora bg-clip-text text-4xl font-semibold text-transparent">
              Widgets
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Forudkonfigurerede eksperter med dedikeret system-prompt, framework-stak og
              starter-prompts. Vælg en widget for at åbne en samtale i den rolle.
            </p>
          </div>
        </header>

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
      </div>
    </div>
  );
}
