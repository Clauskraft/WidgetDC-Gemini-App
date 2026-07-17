import { createFileRoute } from "@tanstack/react-router";
import { BUILD_SHA, BUILT_AT } from "@/lib/build-info";
import { resolveBuildIdentity } from "@/lib/buildSha";

/**
 * GET /health — Railway healthcheck endpoint.
 *
 * Reports BOTH the baked build SHA (the SERVED artifact) and the deploy-env
 * SHA. `build_matches_env=false` means a stale image is being served (a Railway
 * "Redeploy" advanced the env var but not the build). Trust `commit_sha` (the
 * artifact), not the env SHA — the env SHA can lie about what is actually served.
 */
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const envSha =
          process.env.RAILWAY_GIT_COMMIT_SHA ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          process.env.COMMIT_SHA ??
          process.env.GITHUB_SHA ??
          process.env.VITE_GIT_COMMIT_SHA ??
          "unknown";
        const id = resolveBuildIdentity(BUILD_SHA, envSha);
        const body = {
          status: "ok",
          service: "widgetdc-aurora",
          commit_sha: id.commit_sha,
          short_commit_sha: id.short_commit_sha,
          deployed_sha: id.commit_sha,
          git_sha: id.commit_sha,
          build_sha: id.build_sha,
          env_sha: id.env_sha,
          build_matches_env: id.build_matches_env,
          built_at: BUILT_AT,
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
