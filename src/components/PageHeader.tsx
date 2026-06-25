import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number | string;
  onRefresh?: () => void;
  refreshing?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  count,
  onRefresh,
  refreshing,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-3 border-b border-border px-6 py-5", className)}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-aurora shadow-glow">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {(subtitle || count !== undefined) && (
          <p className="text-xs text-muted-foreground truncate">
            {count !== undefined && count !== "" && count !== 0 ? `${count} ` : ""}
            {subtitle}
          </p>
        )}
      </div>
      {action}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Opdatér
        </button>
      )}
    </div>
  );
}
