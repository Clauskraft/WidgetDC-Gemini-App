/**
 * GF-PR3: route-agnostic canvas state, mounted once in __root. The chat
 * publishes its messages and auto-open decisions here; the TopBar toggle and
 * the CanvasDrawer consume it. `userClosedThisThread` suppresses re-auto-open
 * after an explicit close (respect the user's choice for the rest of the
 * thread; a new thread resets it).
 */
import type { UIMessage } from "ai";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type CanvasContextValue = {
  open: boolean;
  /** Messages of the active chat (empty outside chat routes). */
  messages: UIMessage[];
  /** The message the drawer is focused on (defaults to latest structured). */
  focusedMessageId: string | null;
  userClosedThisThread: boolean;
  openCanvas: (messageId?: string) => void;
  closeCanvas: (byUser?: boolean) => void;
  publishMessages: (threadId: string, messages: UIMessage[]) => void;
  setFocusedMessageId: (id: string | null) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside CanvasProvider");
  return ctx;
}

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [userClosedThisThread, setUserClosedThisThread] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const openCanvas = useCallback((messageId?: string) => {
    setOpen(true);
    if (messageId) setFocusedMessageId(messageId);
  }, []);

  const closeCanvas = useCallback((byUser = false) => {
    setOpen(false);
    if (byUser) setUserClosedThisThread(true);
  }, []);

  const publishMessages = useCallback((nextThreadId: string, nextMessages: UIMessage[]) => {
    setMessages(nextMessages);
    setThreadId((prev) => {
      if (prev !== nextThreadId) {
        // New thread: the user's close-choice belongs to the old thread.
        setUserClosedThisThread(false);
        setFocusedMessageId(null);
        setOpen(false);
      }
      return nextThreadId;
    });
  }, []);

  const value = useMemo(
    () => ({
      open,
      messages,
      focusedMessageId,
      userClosedThisThread,
      openCanvas,
      closeCanvas,
      publishMessages,
      setFocusedMessageId,
    }),
    [
      open,
      messages,
      focusedMessageId,
      userClosedThisThread,
      openCanvas,
      closeCanvas,
      publishMessages,
    ],
  );

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}
