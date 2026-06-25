import { useState } from "react";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AUR-4 — human-in-the-loop write governance surface.
 *
 * The browser NEVER executes a write. Each action POSTs to the app's own
 * server route (`/api/governance/plan`), which injects the platform bearer and
 * drives governance_plan_create → approve → execute server-side. This panel is
 * display + intent only; it shows the plan, its risk, and the gated controls.
 */
type PlanSummary = {
  planId: string;
  status: string;
  approved: boolean;
  scope?: string;
  riskLevel?: string;
  description?: string;
  targetService?: string;
};

type ActionResult = { planId: string; status: string; ok: boolean; message?: string };

async function postPlan(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch("/api/governance/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

function riskTone(risk?: string): string {
  const r = (risk ?? "").toLowerCase();
  if (/prod|high|critical/.test(r)) return "text-red-400 border-red-500/40 bg-red-500/10";
  if (/staged|medium|moderate/.test(r)) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-muted-foreground border-border bg-muted/30";
}

export function GovernancePlanPanel({
  approverIdentity = "operator",
}: {
  approverIdentity?: string;
}) {
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("staged_write");
  const [targetService, setTargetService] = useState("orchestrator");
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [busy, setBusy] = useState<null | "create" | "approve" | "execute">(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ActionResult | null>(null);

  async function onCreate() {
    setBusy("create");
    setError(null);
    setLastAction(null);
    try {
      const { ok, data } = await postPlan({
        action: "create",
        description: description.trim(),
        scope: scope.trim(),
        target_service: targetService.trim(),
      });
      if (!ok || !data.plan) {
        setError((data.error as string) ?? "Plan creation failed.");
        return;
      }
      setPlan(data.plan as PlanSummary);
    } finally {
      setBusy(null);
    }
  }

  async function onApprove() {
    if (!plan) return;
    setBusy("approve");
    setError(null);
    try {
      const { ok, data } = await postPlan({
        action: "approve",
        plan_id: plan.planId,
        approver: approverIdentity,
      });
      const result = data.result as ActionResult | undefined;
      if (!ok || !result?.ok) {
        setError((data.error as string) ?? result?.message ?? "Approve was rejected.");
        if (result) setLastAction(result);
        return;
      }
      setLastAction(result);
      setPlan({ ...plan, status: result.status, approved: true });
    } finally {
      setBusy(null);
    }
  }

  async function onExecute() {
    if (!plan) return;
    setBusy("execute");
    setError(null);
    try {
      const { ok, data } = await postPlan({ action: "execute", plan_id: plan.planId });
      const result = data.result as ActionResult | undefined;
      if (!ok || !result?.ok) {
        setError((data.error as string) ?? result?.message ?? "Execute failed.");
        if (result) setLastAction(result);
        return;
      }
      setLastAction(result);
      setPlan({ ...plan, status: result.status });
    } finally {
      setBusy(null);
    }
  }

  const canCreate = description.trim().length > 0 && !busy;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Governance write plan (HITL)</h2>
      </header>
      <p className="mb-4 text-sm text-muted-foreground">
        Create a plan for a write-capable operation, review its risk, then approve and execute. All
        actions run server-side via the platform governance gate — the browser never executes writes
        directly.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="e.g. Promote phantom BOM run X to the production graph"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Scope
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Target service
          <input
            value={targetService}
            onChange={(e) => setTargetService(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
          Create plan
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={!plan || plan.approved || !!busy}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
          Approve
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={!plan || !plan.approved || !!busy}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "execute" && <Loader2 className="h-4 w-4 animate-spin" />}
          Execute
        </button>
      </div>

      {plan && (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{plan.planId}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs">
              {plan.status}
            </span>
            {plan.riskLevel && (
              <span
                className={cn("rounded-full border px-2 py-0.5 text-xs", riskTone(plan.riskLevel))}
              >
                risk: {plan.riskLevel}
              </span>
            )}
            {plan.scope && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {plan.scope}
              </span>
            )}
          </div>
          {plan.description && <p className="mt-2 text-muted-foreground">{plan.description}</p>}
          {lastAction && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last action → {lastAction.status}
              {lastAction.message ? `: ${lastAction.message}` : ""}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
