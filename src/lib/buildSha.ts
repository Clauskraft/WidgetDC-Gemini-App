/**
 * Deploy-parity identity — distinguishes the ARTIFACT commit (baked into the
 * bundle at build time) from the DEPLOY-ENV commit (RAILWAY_GIT_COMMIT_SHA,
 * injected at deploy time).
 *
 * Why this exists: Railway's "Redeploy" re-runs the last BUILT image but
 * re-injects the *current* commit's env metadata. That makes an env-var SHA
 * (what /health used to report) claim "current" while the container serves an
 * OLD build — a stale-image deploy that reads as green. Keying parity on the
 * baked `build_sha` instead of the env SHA makes that failure self-exposing:
 * `build_matches_env === false` ⇒ a stale image is being served.
 */

export const UNKNOWN = "unknown";

export interface BuildIdentity {
  /** Commit baked into the served bundle at build time — the truth about what is served. */
  build_sha: string;
  /** Commit the deploy env claims (RAILWAY_GIT_COMMIT_SHA). Can diverge on a stale-image redeploy. */
  env_sha: string;
  /** The served-artifact truth: build_sha, falling back to env_sha when the build SHA is unknown. */
  commit_sha: string;
  short_commit_sha: string;
  /** true = parity; false = STALE IMAGE (build ≠ env); null = undeterminable (a SHA is unknown). */
  build_matches_env: boolean | null;
}

function norm(v: string | undefined | null): string {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : UNKNOWN;
}

export function resolveBuildIdentity(
  rawBuildSha: string | undefined | null,
  rawEnvSha: string | undefined | null,
): BuildIdentity {
  const build_sha = norm(rawBuildSha);
  const env_sha = norm(rawEnvSha);
  const commit_sha = build_sha !== UNKNOWN ? build_sha : env_sha;
  const build_matches_env =
    build_sha === UNKNOWN || env_sha === UNKNOWN ? null : build_sha === env_sha;
  return {
    build_sha,
    env_sha,
    commit_sha,
    short_commit_sha: commit_sha === UNKNOWN ? UNKNOWN : commit_sha.slice(0, 12),
    build_matches_env,
  };
}
