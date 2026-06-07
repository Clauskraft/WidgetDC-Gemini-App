import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const id = useMemo(() => newId(), []);
  const navigatedRef = useRef(false);

  const handleFirstMessage = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate({ to: "/c/$threadId", params: { threadId: id }, replace: true });
  }, [id, navigate]);

  return <ChatWindow threadId={id} initialMessages={[]} onFirstMessage={handleFirstMessage} />;
}
