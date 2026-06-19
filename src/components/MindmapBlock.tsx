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
 * Loads markmap-lib (Transformer) + markmap-view (Markmap, deriveOptions)
 * via CDN IIFE scripts that both extend window.markmap.
 * d3 is also required by markmap-view.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markmap?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    d3?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-mm-src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.dataset.mmSrc = src;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ready: Promise<{ Transformer: any; Markmap: any; deriveOptions: any }> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureMarkmap(): Promise<{ Transformer: any; Markmap: any; deriveOptions: any }> {
  if (_ready) return _ready;
  _ready = (async () => {
    // markmap-view depends on d3
    await loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js");
    // lib adds Transformer to window.markmap
    await loadScript("https://cdn.jsdelivr.net/npm/markmap-lib@0.17.0/dist/browser/index.iife.js");
    // view adds Markmap + deriveOptions to window.markmap
    await loadScript("https://cdn.jsdelivr.net/npm/markmap-view@0.17.0/dist/browser/index.js");
    const mm = window.markmap;
    if (!mm?.Transformer || !mm?.Markmap) {
      throw new Error("markmap failed to initialise — check CDN");
    }
    return { Transformer: mm.Transformer, Markmap: mm.Markmap, deriveOptions: mm.deriveOptions };
  })();
  return _ready;
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
        const { Transformer, Markmap, deriveOptions } = await ensureMarkmap();
        if (cancelled) return;

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
      <div className="relative w-full" style={{ minHeight: 320 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Indlæser mindmap…
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full"
          style={{ minHeight: 320, display: loading ? "none" : "block" }}
          aria-label="Mindmap diagram"
        />
      </div>
    </figure>
  );
}
