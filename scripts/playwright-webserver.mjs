import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Playwright webServer entry (GF-PR3): boots the PRODUCTION nitro output so
 * e2e runs against the exact bundle that ships to Railway — dev-server-only
 * e2e let a production-breaking wire-protocol bug (#125) stay green. Builds
 * on demand unless PW_SKIP_BUILD=1 (set it when you've just built).
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = resolve(root, ".output", "server", "index.mjs");

if (process.env.PW_SKIP_BUILD !== "1" || !existsSync(serverEntry)) {
  console.log("[pw-webserver] building production output…");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: process.env.PORT ?? process.env.PW_PORT ?? "4173",
};

const server = spawn(process.execPath, [serverEntry], { cwd: root, env, stdio: "inherit" });

function stop(signal) {
  if (!server.killed) server.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
