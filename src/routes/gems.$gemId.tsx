import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { readThreadMessages } from "@/lib/threadStorage";
import { getGem, gemThreadId } from "@/lib/gems";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/gems/$gemId")({
  head: ({ params }) => {
    const gem = getGem(params.gemId);
    return {
      meta: [
        { title: gem ? `${gem.name} · Widget · WidgeTDC Aurora` : "Widget · WidgeTDC Aurora" },
        { name: "description", content: gem?.description ?? "WidgeTDC Aurora Widget" },
      ],
    };
  },
  loader: ({ params }) => {
    const gem = getGem(params.gemId);
    if (!gem) throw notFound();
    return { gemId: gem.id };
  },
  component: GemChatRoute,
  notFoundComponent: () => (
    <div className="flex flex-1 items-center justify-center p-12 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Widget ikke fundet</h1>
        <p className="mt-2 text-muted-foreground">Den widget du leder efter eksisterer ikke.</p>
        <Link to="/gems" className="mt-4 inline-block text-primary hover:underline">
          ← Tilbage til Widgets
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex flex-1 items-center justify-center p-12">
      <pre className="text-sm text-destructive">{String(error)}</pre>
    </div>
  ),
});

function GemChatRoute() {
  const { gemId } = Route.useParams();
  const gem = getGem(gemId)!;
  const threadId = gemThreadId(gem.id);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const initial = useMemo(
    () => (hydrated ? readThreadMessages(threadId) : []),
    [hydrated, threadId],
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border/60 bg-background/60 px-6 py-2 backdrop-blur flex items-center gap-4">
        <Link
          to="/gems"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Alle widgets
        </Link>
        <span className="text-xs text-muted-foreground/70">Widget · {gem.name}</span>
      </div>
      <ChatWindow
        key={`${threadId}:${hydrated}`}
        threadId={threadId}
        initialMessages={initial}
        gem={{
          id: gem.id,
          name: gem.name,
          tagline: gem.tagline,
          systemPrompt: gem.systemPrompt,
          accent: gem.accent,
          starters: gem.starters,
        }}
      />
    </div>
  );
}
