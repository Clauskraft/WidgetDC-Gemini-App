/**
 * IngestSourcesPanel — NotebookLM-style list of ingested documents.
 *
 * Shown as a collapsible tray above the chat input when sources are present.
 * Each source card shows filename, ingest status, and a remove button.
 * The panel also hosts the drag-drop target for new document uploads.
 */
import { useState, useRef } from "react";
import { FileText, X, CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type IngestedSource = {
  id: string;
  filename: string;
  status: "pending" | "ok" | "error";
  error?: string;
};

type Props = {
  sources: IngestedSource[];
  onRemove: (id: string) => void;
  onDropFiles: (files: FileList) => void;
  className?: string;
};

export function IngestSourcesPanel({ sources, onRemove, onDropFiles, className }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  if (sources.length === 0) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) onDropFiles(e.dataTransfer.files);
  };

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 transition-colors",
        dragOver && "border-primary/50 bg-primary/5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kilder ({sources.length})
        </span>
        {dragOver && (
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <Upload className="h-3 w-3" />
            Slip for at tilføje
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src) => (
          <SourceChip key={src.id || src.filename} source={src} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function SourceChip({
  source,
  onRemove,
}: {
  source: IngestedSource;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors",
        source.status === "ok" &&
          "border-green-500/25 bg-green-500/8 text-green-700 dark:text-green-400",
        source.status === "pending" && "border-border bg-muted/50 text-muted-foreground",
        source.status === "error" && "border-destructive/30 bg-destructive/8 text-destructive",
      )}
      title={source.error ?? source.filename}
    >
      {source.status === "pending" && <Loader2 className="h-3 w-3 animate-spin flex-none" />}
      {source.status === "ok" && <CheckCircle2 className="h-3 w-3 flex-none" />}
      {source.status === "error" && <AlertCircle className="h-3 w-3 flex-none" />}
      {source.status !== "pending" && source.status !== "ok" && source.status !== "error" && (
        <FileText className="h-3 w-3 flex-none text-muted-foreground" />
      )}
      <span className="max-w-[14ch] truncate font-medium">{source.filename}</span>
      <button
        onClick={() => onRemove(source.id || source.filename)}
        className="ml-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full opacity-0 transition hover:bg-black/10 group-hover:opacity-100 dark:hover:bg-white/10"
        aria-label={`Fjern ${source.filename}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
