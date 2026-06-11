/**
 * ApprovalQueuePanel — Dashboard surface for two distinct approval stores
 * (LIN-1911 A2.2).
 *
 * Tab 1 — "Backend": shows backend humanApprovalService pending requests
 *   (GOV-7 path, governs backend-internal write tools requiring human review).
 * Tab 2 — "Orchestrator (HyperAgent)": lets the operator look up a plan_id
 *   in orchestrator's approval store and approve it. This is the LIN-1911
 *   critical path — once an orchestrator plan is approved here, backend's
 *   resolveOrchestratorPlan can rebuild it and unblock production_write tools
 *   like graph.promote_phantom_bom_run.
 *
 * No bearers in the browser — every action posts to the Gemini-App's own
 * /api/approvals/{backend,orchestrator} server routes which inject the right
 * server-side bearer.
 */
import { useCallback, useEffect, useState } from "react";
import { Shield, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type Tab = "backend" | "orchestrator";

type BackendRequest = {
  requestId: string;
  toolName?: string;
  description?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

type OrchestratorRecord = {
  approved: boolean;
  plan_id: string;
  scope?: string | null;
  expires_at?: string | null;
  approved_by?: string | null;
  correlation_id?: string | null;
};

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function stringifyDetails(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function formatBackendFailure(status: number, json: { error?: string; details?: unknown }): string {
  const details = stringifyDetails(json.details);
  return [
    `Failed: ${json.error ?? `HTTP ${status}`}`,
    `HTTP ${status}`,
    details ? `Details: ${details}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ApprovalQueuePanel({
  approverIdentity = "operator",
}: {
  approverIdentity?: string;
}) {
  const [tab, setTab] = useState<Tab>("backend");

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">Approval queues</h2>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setTab("backend")}
            className={classNames(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              tab === "backend"
                ? "bg-card text-card-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Backend
          </button>
          <button
            type="button"
            onClick={() => setTab("orchestrator")}
            className={classNames(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              tab === "orchestrator"
                ? "bg-card text-card-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Orchestrator (HyperAgent)
          </button>
        </div>
      </div>
      <div className="p-5">
        {tab === "backend" ? (
          <BackendTab approverIdentity={approverIdentity} />
        ) : (
          <OrchestratorTab approverIdentity={approverIdentity} />
        )}
      </div>
    </section>
  );
}

function BackendTab({ approverIdentity }: { approverIdentity: string }) {
  const [items, setItems] = useState<BackendRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/approvals/backend", {
        headers: { accept: "application/json" },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        requests?: BackendRequest[];
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? `HTTP ${res.status}`);
        setItems([]);
        return;
      }
      setItems(body.requests ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      const normalizedRequestId = requestId.trim();
      const actor = approverIdentity.trim() || "operator";
      if (!normalizedRequestId) {
        setErr("approval_payload_invalid: requestId is required before backend approval POST.");
        return;
      }
      if (!actor) {
        setErr("approval_payload_invalid: approvedBy/rejectedBy is required.");
        return;
      }
      const reason = action === "reject" ? window.prompt("Reason for reject?") : null;
      if (action === "reject" && !reason) return;
      setErr(null);
      setBusyId(normalizedRequestId);
      try {
        const body =
          action === "approve"
            ? { action, requestId: normalizedRequestId, approvedBy: actor }
            : { action, requestId: normalizedRequestId, rejectedBy: actor, reason };
        const res = await fetch("/api/approvals/backend", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          code?: string;
          current_status?: string;
          hint?: string;
          details?: unknown;
        };
        if (!res.ok || !json.ok) {
          // Issue #14: backend now returns structured codes when the request
          // has already been approved/rejected/expired (NOT_PENDING) or no
          // longer exists (NOT_FOUND). Auto-refresh the queue so the stale
          // button disappears, and show a humanized message instead of the
          // generic "Failed: Invalid request" that hides the cause.
          if (json.code === "NOT_PENDING" || json.code === "NOT_FOUND") {
            await load();
            const status = json.current_status ? ` (now ${json.current_status})` : "";
            window.alert(`Request already processed${status}. ${json.hint ?? "Queue refreshed."}`);
          } else {
            window.alert(formatBackendFailure(res.status, json));
          }
        } else {
          await load();
        }
      } catch (e) {
        window.alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusyId(null);
      }
    },
    [approverIdentity, load],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Backend human-approval store (GOV-7 path). Governs backend-internal write tools.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </button>
      </div>
      {err ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err === "backend_not_configured"
            ? "Backend approvals unavailable — set WIDGETDC_BACKEND_URL + WIDGETDC_API_KEY env on this app."
            : err}
        </div>
      ) : items && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending backend approvals.</p>
      ) : items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((r) => (
            <li key={r.requestId} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      {r.toolName ?? "tool"}
                    </span>
                    <span className="truncate text-sm font-medium">{r.requestId}</span>
                  </div>
                  {r.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.description}
                    </p>
                  ) : null}
                  {r.expiresAt ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">expires {r.expiresAt}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void act(r.requestId, "approve")}
                    disabled={busyId === r.requestId}
                    className="inline-flex items-center gap-1 rounded-md border border-green-600/30 bg-green-600/10 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20 disabled:opacity-50 dark:text-green-400"
                  >
                    {busyId === r.requestId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(r.requestId, "reject")}
                    disabled={busyId === r.requestId}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <XCircle className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrchestratorTab({ approverIdentity }: { approverIdentity: string }) {
  const [planId, setPlanId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<OrchestratorRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const lookup = useCallback(async () => {
    const id = planId.trim();
    if (!id) {
      setErr("Enter a plan_id first.");
      return;
    }
    setLoading(true);
    setErr(null);
    setInfo(null);
    setRecord(null);
    try {
      const res = await fetch(`/api/approvals/orchestrator?planId=${encodeURIComponent(id)}`, {
        headers: { accept: "application/json" },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        record?: OrchestratorRecord;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setRecord(body.record ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const approve = useCallback(async () => {
    const id = planId.trim();
    if (!id) {
      setErr("Enter a plan_id first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch("/api/approvals/orchestrator", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ action: "approve", planId: id, approver: approverIdentity }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        record?: OrchestratorRecord;
        error?: string;
        upstream_status?: number;
        upstream_body?: string;
      };
      if (!res.ok || !body.ok) {
        const upstream = body.upstream_status
          ? ` (upstream ${body.upstream_status}${body.upstream_body ? `: ${body.upstream_body}` : ""})`
          : "";
        setErr(`${body.error ?? `HTTP ${res.status}`}${upstream}`);
        return;
      }
      setRecord(body.record ?? null);
      setInfo(`Plan ${id} approved.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [planId, approverIdentity]);

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        LIN-1911 orchestrator plan-approval store. Paste a <code>plan_id</code> from a tool
        response, look it up, and approve to unblock <code>requires_plan</code> backend tools.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          placeholder="hyp-..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Lookup
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={loading || busy || planId.trim().length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-600/20 disabled:opacity-50 dark:text-green-400"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Approve
          </button>
        </div>
      </div>
      {err ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err === "orchestrator_not_configured"
            ? "Orchestrator approvals unavailable — set WIDGETDC_ORCHESTRATOR_URL + WIDGETDC_ORCHESTRATOR_API_KEY env on this app."
            : err}
        </div>
      ) : null}
      {info ? (
        <div className="mt-3 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          {info}
        </div>
      ) : null}
      {record ? (
        <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">plan_id</dt>
            <dd className="font-mono">{record.plan_id}</dd>
            <dt className="text-muted-foreground">approved</dt>
            <dd
              className={
                record.approved ? "text-green-700 dark:text-green-400" : "text-destructive"
              }
            >
              {String(record.approved)}
            </dd>
            {record.scope ? (
              <>
                <dt className="text-muted-foreground">scope</dt>
                <dd>{record.scope}</dd>
              </>
            ) : null}
            {record.approved_by ? (
              <>
                <dt className="text-muted-foreground">approved_by</dt>
                <dd>{record.approved_by}</dd>
              </>
            ) : null}
            {record.expires_at ? (
              <>
                <dt className="text-muted-foreground">expires_at</dt>
                <dd>{record.expires_at}</dd>
              </>
            ) : null}
            {record.correlation_id ? (
              <>
                <dt className="text-muted-foreground">correlation_id</dt>
                <dd className="font-mono">{record.correlation_id}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
