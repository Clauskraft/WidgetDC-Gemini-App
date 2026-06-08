import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { newId } from "@/hooks/useThreads";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WidgeTDC Aurora — Ny samtale" },
      { name: "description", content: "Start en ny samtale med Aurora, et Gemini-drevet AI workspace." },
    ],
  }),
  component: IndexRoute,
});

function IndexRoute() {
  const id = useMemo(() => newId(), []);
  const navigatedRef = useRef(false);

  // On the first message we update the URL to /c/<id> WITHOUT a TanStack
  // route navigation. A real navigate() would unmount this ChatWindow and
  // remount a fresh one on the thread route — discarding the in-flight
  // useChat stream so the assistant reply never rendered/persisted. Using
  // history.replaceState keeps THIS component (and its stream) mounted; the
  // address bar still reflects the thread, and a reload lands on the thread
  // route which reads the now-persisted messages.
  const handleFirstMessage = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/c/${id}`);
    }
  }, [id]);

  return <ChatWindow threadId={id} initialMessages={[]} onFirstMessage={handleFirstMessage} />;
}
