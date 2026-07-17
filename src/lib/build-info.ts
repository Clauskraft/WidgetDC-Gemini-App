/**
 * Build-time artifact identity. This file is OVERWRITTEN by
 * scripts/build-production.mjs at build time with the real commit SHA, so the
 * value is baked into the served bundle. In dev / when unbuilt it stays
 * "unknown". Do not hand-edit the values — they are generated.
 */
export const BUILD_SHA = "unknown";
export const BUILT_AT = "unknown";
