/**
 * The one content-page frame (GF-PR1). Every non-chat route renders inside
 * this: consistent padding, typography and scroll behavior. Pages must never
 * bring their own full-screen theme — the AppShell owns background and grid.
 */
import type { ReactNode } from "react";
import { LayoutPanelTop } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export function PageShell({
  title,
  subtitle,
  icon,
  count,
  onRefresh,
  refreshing,
  actions,
  previewNotice,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  count?: number | string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: ReactNode;
  previewNotice?: string;
  children: ReactNode;
}) {
  return (
    <div data-testid="page-shell" className="flex-1 min-w-0 overflow-y-auto">
      {previewNotice ? (
        <div className="mx-6 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          {previewNotice}
        </div>
      ) : null}
      <PageHeader
        icon={icon ?? <LayoutPanelTop className="h-4 w-4 text-white" />}
        title={title}
        subtitle={subtitle}
        count={count}
        onRefresh={onRefresh}
        refreshing={refreshing}
        action={actions}
      />
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
