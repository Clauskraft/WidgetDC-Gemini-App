import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function firstEnv(names: string[]): { value: string; source: string } | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { value, source: `env.${name}` };
  }
  return null;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export const Route = createFileRoute("/api/release")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => {
        const commit = firstEnv([
          "VERCEL_GIT_COMMIT_SHA",
          "RAILWAY_GIT_COMMIT_SHA",
          "COMMIT_SHA",
          "GITHUB_SHA",
          "VITE_GIT_COMMIT_SHA",
        ]);
        const branch = firstEnv(["VERCEL_GIT_COMMIT_REF", "GIT_BRANCH", "BRANCH"]);
        const environment = firstEnv(["VERCEL_ENV", "RAILWAY_ENVIRONMENT", "NODE_ENV"]);
        const url = firstEnv(["VERCEL_URL", "RAILWAY_PUBLIC_DOMAIN"]);
        const commitSha = commit?.value ?? "unknown";

        return json({
          ok: true,
          status: "ok",
          service: "widgetdc-aurora",
          commit_sha: commitSha,
          short_commit_sha: commitSha === "unknown" ? "unknown" : commitSha.slice(0, 12),
          deployed_sha: commitSha,
          git_sha: commitSha,
          sha_source: commit?.source ?? "missing",
          branch: branch?.value ?? "unknown",
          branch_source: branch?.source ?? "missing",
          environment: environment?.value ?? "unknown",
          environment_source: environment?.source ?? "missing",
          deployment_url: url?.value ?? "unknown",
          deployment_url_source: url?.source ?? "missing",
          read_only: true,
          candidate_only: false,
          graph_write_allowed: false,
          railway_mutation_allowed: false,
          claim_promotion_allowed: false,
          ts: new Date().toISOString(),
        });
      },
    },
  },
});
