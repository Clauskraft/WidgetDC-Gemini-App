import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { readThreadMessages } from "@/lib/threadStorage";

export const Route = createFileRoute("/c/$threadId")({
  head: ({ params }) => ({
    meta: [
      { title: "Samtale · WDC Agent Office" },
      { name: "description", content: `WDC Agent Office samtale ${params.threadId}` },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
  }),
  component: ThreadRoute,
});

function ThreadRoute() {
  const { threadId } = Route.useParams();
  const { prompt } = Route.useSearch();

  // Læs beskeder synkront pr. threadId. `readThreadMessages` er SSR-sikker
  // (returnerer [] uden window), så vi behøver IKKE et `hydrated`-gate — og må
  // ikke have et, fordi et key-skift efter hydrering ville remounte ChatWindow
  // og smide en igangværende useChat-stream væk (assistent-svaret forsvandt).
  const initial = useMemo(() => readThreadMessages(threadId), [threadId]);

  // Key=threadId (KUN) tvinger remount ved tråd-SKIFT, men ikke ved hydrering,
  // så et streamende svar i den nye tråd overlever.
  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      initialMessages={initial}
      initialInput={prompt}
    />
  );
}
