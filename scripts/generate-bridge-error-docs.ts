#!/usr/bin/env bun
/**
 * CLI til at generere `docs/mcp-bridge-error-payloads.generated.md`.
 *
 * Brug:
 *   bun run docs:bridge-errors          # skriv filen
 *   bun run docs:bridge-errors --check  # exit 1 hvis filen er out of date
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GENERATED_DOC_PATH, generateBridgeErrorDocs } from "../src/lib/bridgeErrorDocs";

const target = resolve(process.cwd(), GENERATED_DOC_PATH);
const next = generateBridgeErrorDocs();

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    console.error(`[docs:bridge-errors] ${GENERATED_DOC_PATH} mangler — kør \`bun run docs:bridge-errors\`.`);
    process.exit(1);
  }
  if (current !== next) {
    console.error(
      `[docs:bridge-errors] ${GENERATED_DOC_PATH} er out of sync med fejlkodespecifikationen.\n` +
        `Kør \`bun run docs:bridge-errors\` og commit ændringerne.`,
    );
    process.exit(1);
  }
  console.log(`[docs:bridge-errors] ${GENERATED_DOC_PATH} er up to date.`);
  process.exit(0);
}

writeFileSync(target, next, "utf8");
console.log(`[docs:bridge-errors] wrote ${GENERATED_DOC_PATH} (${next.length} bytes)`);
