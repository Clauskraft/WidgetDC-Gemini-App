import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { EngagementRow } from "@/routes/api/engagements";

type ActiveEngagementContextValue = {
  activeEngagement: EngagementRow | null;
  setActiveEngagement: (e: EngagementRow | null) => void;
};

export const ActiveEngagementContext = createContext<ActiveEngagementContextValue>({
  activeEngagement: null,
  setActiveEngagement: () => {},
});

export function useActiveEngagement() {
  return useContext(ActiveEngagementContext);
}

const SESSION_KEY = "aurora_active_engagement";

export function ActiveEngagementProvider({ children }: { children: ReactNode }) {
  const [activeEngagement, setActiveEngagementState] = useState<EngagementRow | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as EngagementRow) : null;
    } catch {
      return null;
    }
  });

  const setActiveEngagement = useCallback((e: EngagementRow | null) => {
    setActiveEngagementState(e);
    try {
      if (e) sessionStorage.setItem(SESSION_KEY, JSON.stringify(e));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Best-effort persistence: storage can be unavailable in private or embedded contexts.
    }
  }, []);

  return (
    <ActiveEngagementContext.Provider value={{ activeEngagement, setActiveEngagement }}>
      {children}
    </ActiveEngagementContext.Provider>
  );
}
