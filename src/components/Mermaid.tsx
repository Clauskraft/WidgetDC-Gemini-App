import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: true,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
});

export const Mermaid = ({ chart }: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    if (containerRef.current) {
      mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart).then((result) => {
         if (containerRef.current && isMounted) {
            containerRef.current.innerHTML = result.svg;
            const svg = containerRef.current.querySelector('svg');
            if (svg) {
               svg.style.maxWidth = "100%";
               svg.style.height = "auto";
            }
         }
      }).catch(e => {
         console.error(e);
         if (containerRef.current && isMounted) {
             containerRef.current.innerHTML = `<div class="text-red-400 p-4 font-mono text-sm">Failed to render Mermaid diagram</div>`;
         }
      });
    }
    return () => { isMounted = false; };
  }, [chart]);

  return <div ref={containerRef} className="w-full h-full overflow-auto flex justify-center items-center py-4 android-scroll" />;
};
