import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /health — Railway healthcheck endpoint.
 *
 * Returns 200 + minimal JSON so the platform's healthcheck (railway.toml
 * `healthcheckPath = "/health"`) can verify the SSR server is up. Commit SHA
 * is read per-request from env (`RAILWAY_GIT_COMMIT_SHA` is injected by Railway).
 */
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        const body = {
          status: "ok",
          service: "widgetdc-aurora",
          commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? "unknown",
          ts: new Date().toISOString(),
        };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
