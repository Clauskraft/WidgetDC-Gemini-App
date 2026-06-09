import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = resolve(root, "node_modules", "vite", "bin", "vite.js");
const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: process.env.PORT ?? process.env.PW_PORT ?? "4173",
};

const server = spawn(
  process.execPath,
  [viteBin, "dev", "--host", env.HOST, "--port", env.PORT, "--strictPort"],
  { cwd: root, env, stdio: "inherit" },
);

function stop(signal) {
  if (!server.killed) server.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
