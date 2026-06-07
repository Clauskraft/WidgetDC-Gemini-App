import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { readThreadMessages } from "@/lib/threadStorage";

export const Route = createFileRoute("/c/$threadId")({
  head: ({ params }) => ({
    meta: [
      { title: `Samtale · WidgeTDC Aurora` },
      { name: "description", content: `Aurora samtale ${params.threadId}` },
    ],
  }),
  component: ThreadRoute,
});

function ThreadRoute() {
  const { threadId } = Route.useParams();
  // Vent på client-mount før vi læser localStorage — ellers hydration-mismatch.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Synkron udledning pr. threadId så vi ALDRIG arver gamle beskeder
  // når brugeren klikker "Ny chat" eller skifter tråd.
  const initial = useMemo(() => (hydrated ? readThreadMessages(threadId) : []), [hydrated, threadId]);

  // Key=threadId+hydrated tvinger ChatWindow til at remounte ved skift,
  // så useChat ikke fryser den forrige samtales beskeder fast.
  return <ChatWindow key={`${threadId}:${hydrated}`} threadId={threadId} initialMessages={initial} />;
}
