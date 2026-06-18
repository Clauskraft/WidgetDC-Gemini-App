import { useState } from "react";
import { GripVertical, Edit3 } from "lucide-react";
import type { HeadlineSlide } from "@/routes/api/storyline";

export function SlideCard({
  slide,
  index,
  total,
  onUpdate,
  onMoveUp,
  onMoveDown,
}: {
  slide: HeadlineSlide;
  index: number;
  total: number;
  onUpdate: (updated: HeadlineSlide) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editingGT, setEditingGT] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <GripVertical className="h-3 w-3 rotate-180" />
          </button>
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
            {editingGT ? (
              <textarea
                autoFocus
                value={slide.governing_thought}
                onChange={(e) => onUpdate({ ...slide, governing_thought: e.target.value })}
                onBlur={() => setEditingGT(false)}
                rows={2}
                placeholder="Governing thought — hvad er konklusionen på denne slide?"
                className="w-full resize-none rounded border border-primary/50 bg-background px-2 py-1 text-sm text-primary outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingGT(true)}
                className="w-full text-left text-sm text-primary font-medium italic"
              >
                {slide.governing_thought || (
                  <span className="text-muted-foreground not-italic">"Klik for at tilføje governing thought…"</span>
                )}
                <Edit3 className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-60" />
              </button>
            )}
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
    </div>
  );
}
