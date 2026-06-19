import { useEffect, useState } from "react";

export interface CostBudget {
  used: number;
  budget: number;
  pct: number;
  isLow: boolean;
  costPer1K: number;
  loading: boolean;
  error: boolean;
}

const POLL_INTERVAL_MS = 60_000;

const DEFAULT: CostBudget = {
  used: 0,
  budget: 100,
  pct: 100,
  isLow: false,
  costPer1K: 0,
  loading: true,
  error: false,
};

export function useCostBudget(): CostBudget {
  const [state, setState] = useState<CostBudget>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    async function fetch_() {
      try {
        const res = await fetch("/api/cost");
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as {
          dailyUsedDKK: number;
          dailyBudgetDKK: number;
          remainingPct: number;
          costPer1K: number;
          isLow: boolean;
        };
        if (!cancelled) {
          setState({
            used: data.dailyUsedDKK,
            budget: data.dailyBudgetDKK,
            pct: data.remainingPct,
            isLow: data.isLow,
            costPer1K: data.costPer1K,
            loading: false,
            error: false,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }

    fetch_();
    const id = setInterval(fetch_, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
