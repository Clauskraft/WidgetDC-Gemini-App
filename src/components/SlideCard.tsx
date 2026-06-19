import { useRef, useState } from "react";
import { GripVertical, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeadlineSlide } from "@/routes/api/storyline";
import { OutlineEditor } from "@/components/OutlineEditor";

export function SlideCard({
  slide,
  index,
  total,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDrop,
}: {
  slide: HeadlineSlide;
  index: number;
  total: number;
  onUpdate: (updated: HeadlineSlide) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDrop?: (fromIndex: number, toIndex: number) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [dragOver, setDragOver] = useState<"top" | "bottom" | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    setDragOver(e.clientY < mid ? "top" : "bottom");
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(fromIndex) || fromIndex === index) return;
    if (!dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const insertAfter = e.clientY >= mid;
    let toIndex = insertAfter ? index : index - 1;
    if (fromIndex < index) toIndex = insertAfter ? index : index - 1;
    else toIndex = insertAfter ? index + 1 : index;
    // clamp
    toIndex = Math.max(0, Math.min(total - 1, toIndex));
    if (toIndex !== fromIndex) onDrop?.(fromIndex, toIndex);
  };

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all duration-200 select-none",
        dragging
          ? "opacity-40 scale-[0.98] border-primary/40 shadow-none"
          : "border-border hover:border-primary/40 hover:shadow-md",
        dragOver === "top" && "border-t-2 border-t-primary shadow-[0_-3px_0_0] shadow-primary/30",
        dragOver === "bottom" && "border-b-2 border-b-primary shadow-[0_3px_0_0] shadow-primary/30",
      )}
    >
      {/* Top drop indicator */}
      {dragOver === "top" && (
        <div className="pointer-events-none absolute -top-1 left-4 right-4 h-0.5 rounded-full bg-primary shadow-[0_0_6px_2px] shadow-primary/40" />
      )}

      <div className="mb-2 flex items-start gap-2">
        {/* Drag handle */}
        <div
          className="flex flex-col items-center justify-center pt-1 cursor-grab active:cursor-grabbing touch-none"
          title="Træk for at ændre rækkefølge"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {index + 1}
            </span>
            {editingTitle ? (
              <input
                autoFocus
                value={slide.title}
                onChange={(e) => onUpdate({ ...slide, title: e.target.value })}
                onBlur={() => setEditingTitle(false)}
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="flex-1 text-left text-sm font-semibold text-foreground hover:text-primary"
              >
                {slide.title}
                <Edit3 className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-60" />
              </button>
            )}
          </div>

          <div className="mb-2 ml-7">
            <OutlineEditor
              value={slide.governing_thought}
              onChange={(text) => onUpdate({ ...slide, governing_thought: text })}
              placeholder="Governing thought — hvad er konklusionen på denne slide?"
            />
          </div>

          <ul className="ml-7 space-y-1">
            {slide.key_points.map((pt, pi) => (
              <li key={pi} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 text-primary">▸</span>
                <input
                  value={pt}
                  onChange={(e) => {
                    const points = [...slide.key_points];
                    points[pi] = e.target.value;
                    onUpdate({ ...slide, key_points: points });
                  }}
                  className="flex-1 bg-transparent outline-none hover:underline focus:underline"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom drop indicator */}
      {dragOver === "bottom" && (
        <div className="pointer-events-none absolute -bottom-1 left-4 right-4 h-0.5 rounded-full bg-primary shadow-[0_0_6px_2px] shadow-primary/40" />
      )}
    </div>
  );
}
