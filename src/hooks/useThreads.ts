import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const KEY = "widgetdc.threads.v1";

function load(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(threads: Thread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(threads));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThreads(load());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Thread[]) => {
    const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    setThreads(sorted);
    save(sorted);
  }, []);

  const upsertThread = useCallback(
    (id: string, patch: Partial<Thread>) => {
      const current = load();
      const idx = current.findIndex((t) => t.id === id);
      const base: Thread =
        idx >= 0
          ? current[idx]
          : { id, title: "Ny samtale", updatedAt: Date.now(), messages: [] };
      const next: Thread = { ...base, ...patch, id, updatedAt: Date.now() };
      const arr = idx >= 0 ? [...current.slice(0, idx), next, ...current.slice(idx + 1)] : [next, ...current];
      persist(arr);
    },
    [persist],
  );

  const deleteThread = useCallback(
    (id: string) => {
      persist(load().filter((t) => t.id !== id));
    },
    [persist],
  );

  const getThread = useCallback((id: string): Thread | undefined => {
    return load().find((t) => t.id === id);
  }, []);

  return { threads, hydrated, upsertThread, deleteThread, getThread };
}
