import { useMemo } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_OPTIONS, getModelMeta, useModelPreference } from "@/lib/modelPreference";
import { cn } from "@/lib/utils";
import { CostBadge } from "@/components/CostBadge";
import { useCostBudget } from "@/hooks/useCostBudget";

export function ModelPicker({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const [model, setModel] = useModelPreference();
  const meta = getModelMeta(model);
  const cost = useCostBudget();

  const grouped = useMemo(() => {
    const g = new Map<string, typeof MODEL_OPTIONS>();
    for (const m of MODEL_OPTIONS) {
      const arr = g.get(m.vendor) ?? [];
      arr.push(m);
      g.set(m.vendor, arr);
    }
    return [...g.entries()];
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:bg-accent",
          variant === "full" && "text-sm",
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[180px]">{meta?.label ?? model}</span>
        {!cost.loading && !cost.error && cost.pct < 80 && (
          <CostBadge pct={cost.pct} usedDKK={cost.used} compact />
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {grouped.map(([vendor, items], i) => (
          <div key={vendor}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {vendor}
            </DropdownMenuLabel>
            {items.map((m) => {
              const active = m.id === model;
              return (
                <DropdownMenuItem
                  key={m.id}
                  onSelect={() => setModel(m.id)}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5",
                      active ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.tier}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{m.hint}</div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
