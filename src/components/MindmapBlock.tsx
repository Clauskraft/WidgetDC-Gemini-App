import { useEffect, useRef, useState } from "react";

/**
 * MindmapBlock — renders ```mindmap``` fenced blocks.
 *
 * Input: Markdown-style indented bullet list (standard markmap format):
 *
 *   ```mindmap
 *   root
 *     branch1
 *       leaf1
 *       leaf2
 *     branch2
 *       leaf3
 *   ```
 *
 * Uses markmap-lib + markmap-view via CDN (jsdelivr).
 * Falls back gracefully if markmap fails to load.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markmap?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureMarkmap(): Promise<void> {
  if (window.markmap?.Markmap) return;
  await loadScript("https://cdn.jsdelivr.net/npm/markmap-lib@0.17.0/dist/browser/index.js");
  await loadScript("https://cdn.jsdelivr.net/npm/markmap-view@0.17.0/dist/browser/index.js");
}

export function MindmapBlock({ content }: { content: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        await ensureMarkmap();
        if (cancelled) return;

        const { Transformer } = window.markmap;
        const { Markmap, deriveOptions } = window.markmap;

        const transformer = new Transformer();
        const { root, features } = transformer.transform(content.trim());
        const opts = deriveOptions(features);

        if (svgRef.current) {
          svgRef.current.innerHTML = "";
          const mm = Markmap.create(svgRef.current, opts);
          mm.setData(root);
          await mm.fit();
        }

        if (!cancelled) setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message.slice(0, 300) : "Mindmap render failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (error) {
    return (
      <figure className="aurora-figure">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Mindmap-fejl: {error}
        </div>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">{content}</pre>
      </figure>
    );
  }

  return (
    <figure className="aurora-figure aurora-figure--flat">
      <div className="relative w-full" style={{ minHeight: 280 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Indlæser mindmap…
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full"
          style={{ minHeight: 280, display: loading ? "none" : "block" }}
          aria-label="Mindmap diagram"
        />
      </div>
    </figure>
  );
}
