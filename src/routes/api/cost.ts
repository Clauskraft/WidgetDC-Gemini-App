import { createFileRoute } from "@tanstack/react-router";
import { callMcpTool } from "@/lib/widgetdc.server";

const DAILY_BUDGET_DKK = 100;

export const Route = createFileRoute("/api/cost")({
  server: {
    handlers: {
      GET: async () => {
        const correlationId = crypto.randomUUID();

        const [budgetRaw, estimateRaw] = await Promise.allSettled([
          callMcpTool<Record<string, unknown>>(
            "model_budget_status",
            { window_hours: 24 },
            { correlationId, timeoutMs: 8000 },
          ),
          callMcpTool<Record<string, unknown>>(
            "model_cost_estimate",
            { provider: "openai", model: "gpt-4o", estimated_tokens: 1000 },
            { correlationId, timeoutMs: 8000 },
          ),
        ]);

        const budget = budgetRaw.status === "fulfilled" ? budgetRaw.value : null;
        const estimate = estimateRaw.status === "fulfilled" ? estimateRaw.value : null;

        const dailyUsedDKK =
          typeof budget?.total_cost_dkk === "number"
            ? budget.total_cost_dkk
            : typeof budget?.totalCostDKK === "number"
              ? budget.totalCostDKK
              : 0;

        const dailyBudgetDKK = DAILY_BUDGET_DKK;
        const remainingPct = Math.max(
          0,
          Math.round(((dailyBudgetDKK - dailyUsedDKK) / dailyBudgetDKK) * 100),
        );
        const isLow = remainingPct < 20;

        const costPer1K =
          typeof estimate?.costPer1KTokensDKK === "number"
            ? estimate.costPer1KTokensDKK
            : typeof estimate?.total_cost_dkk === "number"
              ? estimate.total_cost_dkk
              : 0;

        return new Response(
          JSON.stringify({ dailyUsedDKK, dailyBudgetDKK, remainingPct, costPer1K, isLow }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=60, stale-while-revalidate=120",
              "x-correlation-id": correlationId,
            },
          },
        );
      },
    },
  },
});
