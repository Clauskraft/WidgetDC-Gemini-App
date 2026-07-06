import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /health — Railway healthcheck endpoint.
 *
 * Returns 200 + minimal JSON so platform healthchecks can verify the SSR
 * server is up. Commit SHA is read per-request from deployment env.
 */
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const commitSha =
          process.env.VERCEL_GIT_COMMIT_SHA ??
          process.env.RAILWAY_GIT_COMMIT_SHA ??
          process.env.COMMIT_SHA ??
          process.env.GITHUB_SHA ??
          process.env.VITE_GIT_COMMIT_SHA ??
          "unknown";
        const body = {
          status: "ok",
          service: "widgetdc-aurora",
          commit_sha: commitSha,
          short_commit_sha: commitSha === "unknown" ? "unknown" : commitSha.slice(0, 12),
          deployed_sha: commitSha,
          git_sha: commitSha,
          environment:
            process.env.VERCEL_ENV ??
            process.env.RAILWAY_ENVIRONMENT ??
            process.env.NODE_ENV ??
            "unknown",
          read_only: true,
          graph_write_allowed: false,
          railway_mutation_allowed: false,
          claim_promotion_allowed: false,
          ts: new Date().toISOString(),
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
