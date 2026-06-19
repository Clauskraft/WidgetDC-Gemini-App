import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  BookOpen,
  Boxes,
  Search,
  Loader2,
  ChevronRight,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngagementRow } from "../routes/api/engagements";
import type { PatternRow } from "../routes/api/patterns";
import type { AssemblyBlockRow } from "../routes/api/consulting.assemble";

type ResultItem =
  | { kind: "engagement"; data: EngagementRow }
  | { kind: "pattern"; data: PatternRow }
  | { kind: "block"; data: AssemblyBlockRow };

type GroupLoading = { engagements: boolean; patterns: boolean; blocks: boolean };

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function DomainBadge({ domain }: { domain: string | null | undefined }) {
  if (!domain) return null;
  return (
    <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/25">
      {domain}
    </span>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-3">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyGroup({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 text-[12px] text-muted-foreground/70">
      Ingen {label}
    </div>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [loading, setLoading] = useState<GroupLoading>({ engagements: false, patterns: false, blocks: false });
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [blocks, setBlocks] = useState<AssemblyBlockRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 200);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFocusedIdx(0);
    setEngagements([]);
    setPatterns([]);
    setBlocks([]);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery("");
            setFocusedIdx(0);
          }
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setEngagements([]);
      setPatterns([]);
      setBlocks([]);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading({ engagements: true, patterns: true, blocks: true });
    setFocusedIdx(0);

    const q = encodeURIComponent(debouncedQuery);

    fetch(`/api/engagements?q=${q}&limit=5`, { signal: ac.signal })
      .then((r) => r.json())
      .then((body) => setEngagements((body.engagements ?? []) as EngagementRow[]))
      .catch(() => {})
      .finally(() => setLoading((prev) => ({ ...prev, engagements: false })));

    fetch(`/api/patterns?q=${q}&limit=5`, { signal: ac.signal })
      .then((r) => r.json())
      .then((body) => setPatterns((body.patterns ?? []) as PatternRow[]))
      .catch(() => {})
      .finally(() => setLoading((prev) => ({ ...prev, patterns: false })));

    fetch("/api/consulting/assemble", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: debouncedQuery, max_blocks: 3 }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((body) => setBlocks((body.bom ?? []) as AssemblyBlockRow[]))
      .catch(() => {})
      .finally(() => setLoading((prev) => ({ ...prev, blocks: false })));

    return () => ac.abort();
  }, [debouncedQuery, open]);

  const flatItems: ResultItem[] = [
    ...engagements.map((e): ResultItem => ({ kind: "engagement", data: e })),
    ...patterns.map((p): ResultItem => ({ kind: "pattern", data: p })),
    ...blocks.map((b): ResultItem => ({ kind: "block", data: b })),
  ];

  const handleSelect = useCallback(
    (item: ResultItem) => {
      close();
      if (item.kind === "engagement") navigate({ to: "/engagements" });
      else if (item.kind === "pattern") navigate({ to: "/patterns" });
      else navigate({ to: "/consulting" });
    },
    [close, navigate],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((prev) => (flatItems.length ? Math.min(prev + 1, flatItems.length - 1) : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && flatItems[focusedIdx]) {
        e.preventDefault();
        handleSelect(flatItems[focusedIdx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close, flatItems, focusedIdx, handleSelect]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${focusedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIdx]);

  const hasQuery = debouncedQuery.length >= 2;
  const anyLoading = loading.engagements || loading.patterns || loading.blocks;
  const noResults = hasQuery && !anyLoading && engagements.length === 0 && patterns.length === 0 && blocks.length === 0;

  let globalIdx = 0;

  function itemIdx(): number {
    return globalIdx++;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      onClick={close}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Søg i WidgeTDC"
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg engagements, patterns, knowledge..."
            className="flex-1 bg-transparent py-4 text-lg text-foreground placeholder:text-muted-foreground/60 outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex shrink-0 items-center gap-1">
            <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-[420px] overflow-y-auto overscroll-contain pb-2"
        >
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground/60">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">Skriv mindst 2 tegn for at søge</p>
            </div>
          )}

          {noResults && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground/60">
              <p className="text-sm">
                Ingen resultater for{" "}
                <span className="font-medium text-foreground">"{debouncedQuery}"</span>
              </p>
            </div>
          )}

          {hasQuery && (
            <>
              <SectionHeader label="Engagements" />
              {loading.engagements ? (
                <Spinner />
              ) : engagements.length === 0 ? (
                <EmptyGroup label="engagements" />
              ) : (
                engagements.map((eng) => {
                  const idx = itemIdx();
                  const focused = idx === focusedIdx;
                  return (
                    <button
                      key={eng.id}
                      data-idx={idx}
                      onClick={() => handleSelect({ kind: "engagement", data: eng })}
                      onMouseEnter={() => setFocusedIdx(idx)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg mx-1 px-3 py-2.5 text-left transition-colors",
                        focused ? "bg-primary/10 text-primary" : "hover:bg-accent",
                      )}
                    >
                      <Briefcase
                        className={cn(
                          "h-4 w-4 shrink-0",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {eng.name}
                        </span>
                        {eng.client && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {eng.client}
                          </span>
                        )}
                      </span>
                      <DomainBadge domain={eng.domain} />
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                          focused && "opacity-100",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </button>
                  );
                })
              )}

              <SectionHeader label="Patterns" />
              {loading.patterns ? (
                <Spinner />
              ) : patterns.length === 0 ? (
                <EmptyGroup label="patterns" />
              ) : (
                patterns.map((pat) => {
                  const idx = itemIdx();
                  const focused = idx === focusedIdx;
                  return (
                    <button
                      key={pat.id}
                      data-idx={idx}
                      onClick={() => handleSelect({ kind: "pattern", data: pat })}
                      onMouseEnter={() => setFocusedIdx(idx)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg mx-1 px-3 py-2.5 text-left transition-colors",
                        focused ? "bg-primary/10 text-primary" : "hover:bg-accent",
                      )}
                    >
                      <BookOpen
                        className={cn(
                          "h-4 w-4 shrink-0",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {pat.name}
                        </span>
                        {pat.description && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {pat.description}
                          </span>
                        )}
                      </span>
                      <DomainBadge domain={pat.domain} />
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                          focused && "opacity-100",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </button>
                  );
                })
              )}

              <SectionHeader label="Knowledge Blocks" />
              {loading.blocks ? (
                <Spinner />
              ) : blocks.length === 0 ? (
                <EmptyGroup label="knowledge blocks" />
              ) : (
                blocks.map((block) => {
                  const idx = itemIdx();
                  const focused = idx === focusedIdx;
                  return (
                    <button
                      key={block.id}
                      data-idx={idx}
                      onClick={() => handleSelect({ kind: "block", data: block })}
                      onMouseEnter={() => setFocusedIdx(idx)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg mx-1 px-3 py-2.5 text-left transition-colors",
                        focused ? "bg-primary/10 text-primary" : "hover:bg-accent",
                      )}
                    >
                      <Boxes
                        className={cn(
                          "h-4 w-4 shrink-0",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {block.title ?? block.id}
                        </span>
                        {block.content && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {block.content.slice(0, 80)}
                          </span>
                        )}
                      </span>
                      <DomainBadge domain={block.domain} />
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                          focused && "opacity-100",
                          focused ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px]">↑↓</kbd>
              navigér
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px]">↵</kbd>
              åbn
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[9px]">esc</kbd>
              luk
            </span>
          </div>
          {hasQuery && !anyLoading && (
            <span className="text-[10px] text-muted-foreground/50">
              {flatItems.length} {flatItems.length === 1 ? "resultat" : "resultater"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
