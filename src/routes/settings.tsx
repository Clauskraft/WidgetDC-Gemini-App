import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2, Download, Database, Sparkles, Bug } from "lucide-react";
import { useThreads } from "@/hooks/useThreads";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Indstillinger — WidgeTDC Aurora" },
      {
        name: "description",
        content: "Tilpas dit Aurora workspace: data, udseende og udvikleropsætning.",
      },
    ],
  }),
  component: SettingsRoute,
});

const STORAGE_KEYS = ["widgetdc.threads.v1"];

function SettingsRoute() {
  const { threads, hydrated, deleteThread } = useThreads();
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let total = 0;
    for (const k of STORAGE_KEYS) {
      const v = localStorage.getItem(k);
      if (v) total += v.length;
    }
    setStorageBytes(total);
    setReduceMotion(localStorage.getItem("widgetdc.reduceMotion") === "1");
    setDebugMode(localStorage.getItem("widgetdc.debug") === "1");
  }, [threads.length]);

  const toggleReduceMotion = (v: boolean) => {
    setReduceMotion(v);
    localStorage.setItem("widgetdc.reduceMotion", v ? "1" : "0");
    document.documentElement.dataset.reduceMotion = v ? "1" : "0";
  };

  const toggleDebug = (v: boolean) => {
    setDebugMode(v);
    localStorage.setItem("widgetdc.debug", v ? "1" : "0");
  };

  const exportThreads = () => {
    const blob = new Blob([JSON.stringify(threads, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurora-threads-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (!confirm("Slet ALLE samtaler? Dette kan ikke fortrydes.")) return;
    threads.forEach((t) => deleteThread(t.id));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Indstillinger</h1>
            <p className="text-sm text-muted-foreground">Tilpas dit Aurora workspace.</p>
          </div>
        </header>

        <Section title="Udseende" icon={<Sparkles className="h-4 w-4" />}>
          <Row
            label="Reducér animationer"
            description="Slå overgange og glow-effekter fra for et roligere interface."
          >
            <Toggle checked={reduceMotion} onChange={toggleReduceMotion} />
          </Row>
        </Section>

        <Section title="Data & samtaler" icon={<Database className="h-4 w-4" />}>
          <Row
            label="Lokale samtaler"
            description={
              hydrated
                ? `${threads.length} tråd${threads.length === 1 ? "" : "e"} gemt lokalt`
                : "Indlæser…"
            }
          >
            <span className="text-xs text-muted-foreground">
              {storageBytes != null ? `${(storageBytes / 1024).toFixed(1)} KB` : ""}
            </span>
          </Row>
          <Row label="Eksportér" description="Download alle dine samtaler som JSON.">
            <button
              onClick={exportThreads}
              disabled={!threads.length}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> Eksportér
            </button>
          </Row>
          <Row label="Ryd alt" description="Slet alle lokale samtaler permanent.">
            <button
              onClick={clearAll}
              disabled={!threads.length}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Slet alt
            </button>
          </Row>
        </Section>

        <Section title="Udvikler" icon={<Bug className="h-4 w-4" />}>
          <Row label="Debug-tilstand" description="Vis ekstra metadata for gem-svar og self-heal.">
            <Toggle checked={debugMode} onChange={toggleDebug} />
          </Row>
          <Row label="Debug-logs" description="Se rå server-logs og bridge-events.">
            <Link
              to="/debug/logs"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Åbn logs
            </Link>
          </Row>
        </Section>

        <Section title="Om" icon={<Sparkles className="h-4 w-4" />}>
          <Row label="WidgeTDC Aurora" description="Workspace drevet af WidgeTDC-platformen.">
            <span className="text-xs text-muted-foreground">v0.1</span>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card/50 shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
