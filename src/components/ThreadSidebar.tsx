import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

interface Thread {
  id: string;
  title: string;
  updatedAt: number;
}

export function ThreadSidebar({ threads }: { threads: Thread[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return threads;
    const q = search.toLowerCase();
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Søg samtaler..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-7 text-xs bg-sidebar-accent/50 rounded-md border border-sidebar-border placeholder:text-muted-foreground/60 outline-none focus:bg-sidebar-accent focus:border-sidebar-accent transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 px-3 py-2">
            {search ? "Ingen resultater" : "Ingen samtaler"}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((thread) => (
              <li key={thread.id}>
                <a
                  href={`/c/${thread.id}`}
                  className="block px-3 py-1.5 text-xs rounded-md hover:bg-sidebar-accent transition truncate"
                >
                  {thread.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
