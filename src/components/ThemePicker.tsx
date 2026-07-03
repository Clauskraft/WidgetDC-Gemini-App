import { cn } from "@/lib/utils";
import type { DocTheme } from "@/lib/output-generators";

export const THEMES: { id: DocTheme; label: string; dot: string }[] = [
  { id: "modern", label: "Modern", dot: "bg-blue-500" },
  { id: "mckinsey", label: "McKinsey", dot: "bg-indigo-600" },
  { id: "bcg", label: "BCG", dot: "bg-emerald-600" },
  { id: "bain", label: "Bain", dot: "bg-red-600" },
  { id: "dark", label: "Dark", dot: "bg-slate-700" },
];

export function ThemePicker({
  value,
  onChange,
}: {
  value: DocTheme;
  onChange: (theme: DocTheme) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
            value === t.id
              ? "border-primary text-foreground"
              : "border-input text-muted-foreground hover:bg-accent",
          )}
        >
          <div className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
