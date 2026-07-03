import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const sliceLintFiles = [
  "src/components/AppSidebar.tsx",
  "src/components/WdcLogo.tsx",
  "src/components/CapabilityResolverPanel.tsx",
  "src/lib/wdcBrand.ts",
  "src/lib/capabilityOrchestration.ts",
  "src/routes/capabilities.tsx",
];

const proofBoundaryFiles = [
  "docs/frontend/frontend-toolbox-orbit-plan.md",
  "docs/frontend/lovable-cockpit-prototype-prompts.md",
  "docs/frontend/lovable-intake-contract.md",
  "docs/frontend/toolbox-architecture.md",
  "docs/frontend/universal-capability-orchestration-closure-v3.md",
  "docs/frontend/wdc-brand-contract.md",
  "src/components/CapabilityResolverPanel.tsx",
  "src/lib/capabilityOrchestration.ts",
  "src/routes/capabilities.tsx",
];

const runtimeCodeFiles = [
  "src/components/CapabilityResolverPanel.tsx",
  "src/lib/capabilityOrchestration.ts",
  "src/routes/capabilities.tsx",
];

const forbiddenClaimPhrases = [
  "world-class complete",
  "runtime proven",
  "adoption proven",
  "all capabilities governed",
  "zero legacy",
  "fully autonomous",
  "claim ready",
  "gemini is the orchestrator",
  "orchestrator authority",
];

const staleReadbackPatterns = [
  /backend tool count readback:\s*`?400`?/i,
  /backend tools readback\s*`?400`?/i,
  /\b400\/400\b/i,
  /\b400 capabilities\b/i,
  /\bcapabilities active:\s*400\b/i,
];

const prohibitedRuntimeCalls = [
  "graph.write_cypher",
  "claims.promote",
  "railway up",
  "railway.volume_candidate_materialize",
  "claim_promotion: true",
  "graph_write_allowed: true",
];

const failures = [];

function readRequiredFile(file) {
  if (!existsSync(file)) {
    failures.push(`missing required file: ${file}`);
    return "";
  }

  return readFileSync(file, "utf8");
}

for (const file of proofBoundaryFiles) {
  const content = readRequiredFile(file);
  const lower = content.toLowerCase();

  for (const phrase of forbiddenClaimPhrases) {
    if (lower.includes(phrase)) {
      failures.push(`${file}: forbidden claim phrase "${phrase}"`);
    }
  }

  for (const pattern of staleReadbackPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file}: stale capability/tool-count readback matched ${pattern}`);
    }
  }
}

const routeContent = readRequiredFile("src/routes/capabilities.tsx");
for (const evidenceClass of ["candidate", "diagnostic", "runtime", "claim"]) {
  if (!routeContent.includes(evidenceClass)) {
    failures.push(`src/routes/capabilities.tsx: missing evidence class ${evidenceClass}`);
  }
}

for (const file of runtimeCodeFiles) {
  const content = readRequiredFile(file).toLowerCase();
  for (const call of prohibitedRuntimeCalls) {
    if (content.includes(call)) {
      failures.push(`${file}: prohibited runtime/claim mutation surface "${call}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("capability cockpit guard failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const eslintBin = "node_modules/eslint/bin/eslint.js";
if (!existsSync(eslintBin)) {
  console.error(`capability cockpit guard failed: missing local eslint binary at ${eslintBin}`);
  process.exit(1);
}

const lint = spawnSync(process.execPath, [eslintBin, ...sliceLintFiles], {
  stdio: "inherit",
});

if (lint.error) {
  console.error(`capability cockpit guard failed to start eslint: ${lint.error.message}`);
  process.exit(1);
}

if (lint.status !== 0) {
  process.exit(lint.status ?? 1);
}

console.log("capability cockpit guard passed");
