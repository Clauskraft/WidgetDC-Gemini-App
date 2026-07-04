// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Self-hosted (Railway) deploy target. Outside a Lovable sandbox this pins the
  // nitro preset to a standalone Node server (.output/server/index.mjs) instead
  // of the Cloudflare default. Vercel sets VERCEL=1 during build, so use Nitro's
  // Vercel output there instead of making Vercel look for a non-existent dist/.
  // Inside a Lovable sandbox these overrides are ignored and the Cloudflare
  // layout is forced (see config docs).
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },
  vite: {
    // Keep the graph/figure rendering stack pre-optimized in dev. If Vite discovers
    // these only after the first SSR pass, it re-optimizes and can temporarily make
    // the virtual TanStack client entry unavailable, which Lovable reports as a
    // blank-screen SSR failure.
    optimizeDeps: {
      include: [
        "@ai-sdk/react",
        "@supabase/supabase-js",
        "ai",
        "dompurify",
        "lucide-react",
        "mermaid",
        "react-markdown",
        "recharts",
      ],
      // markmap packages are ESM-only and import from each other via bare specifiers;
      // esbuild can't resolve them during pre-bundling — exclude and let Vite serve them raw.
      exclude: ["markmap-lib", "markmap-view", "markmap-common", "markmap-html-parser"],
    },
  },
});
