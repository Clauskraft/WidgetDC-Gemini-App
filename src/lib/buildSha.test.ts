import { describe, it, expect } from "vitest";
import { resolveBuildIdentity } from "./buildSha";

describe("resolveBuildIdentity — artifact vs deploy-env SHA", () => {
  it("parity: build == env → build_matches_env true, commit = that sha", () => {
    const r = resolveBuildIdentity("0c996ac8c385", "0c996ac8c385");
    expect(r.build_matches_env).toBe(true);
    expect(r.commit_sha).toBe("0c996ac8c385");
    expect(r.short_commit_sha).toBe("0c996ac8c385");
  });

  it("STALE IMAGE: build (old) != env (new) → false, commit = the SERVED build sha", () => {
    // The exact production failure: env says new, artifact is old.
    const r = resolveBuildIdentity("aaold111111111", "0c996acNEWsha1");
    expect(r.build_matches_env).toBe(false);
    // commit_sha must be the ARTIFACT truth (what is served), not the env claim.
    expect(r.commit_sha).toBe("aaold111111111");
    expect(r.env_sha).toBe("0c996acNEWsha1");
  });

  it("build unknown, env set → null, commit falls back to env", () => {
    const r = resolveBuildIdentity("unknown", "0c996ac8c385");
    expect(r.build_matches_env).toBeNull();
    expect(r.commit_sha).toBe("0c996ac8c385");
  });

  it("both unknown → null, commit unknown", () => {
    const r = resolveBuildIdentity(undefined, "");
    expect(r.build_matches_env).toBeNull();
    expect(r.commit_sha).toBe("unknown");
    expect(r.short_commit_sha).toBe("unknown");
  });

  it("trims whitespace / empty → unknown", () => {
    const r = resolveBuildIdentity("   ", "  0c996ac  ");
    expect(r.build_sha).toBe("unknown");
    expect(r.env_sha).toBe("0c996ac");
    expect(r.build_matches_env).toBeNull();
  });
});
