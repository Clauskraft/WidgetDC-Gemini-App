import type { ProofBoundary } from "./toolboxCatalog";

export interface KnowledgePackManifestInput {
  sourceCommit: string;
  sourceWindow: string[];
  contentHash: string;
  generatedAt: string;
  currentCommit?: string;
}

export interface KnowledgePackManifest {
  id: "knowledge-pack-factory";
  boundary: Extract<ProofBoundary, "diagnostic">;
  sourceCommit: string;
  sourceWindow: string[];
  contentHash: string;
  generatedAt: string;
  stale: boolean;
  graphTruth: false;
  runtimeProof: false;
}

export function createKnowledgePackManifest(
  input: KnowledgePackManifestInput,
): KnowledgePackManifest {
  const currentCommit = input.currentCommit ?? input.sourceCommit;

  return {
    id: "knowledge-pack-factory",
    boundary: "diagnostic",
    sourceCommit: input.sourceCommit,
    sourceWindow: [...input.sourceWindow],
    contentHash: input.contentHash,
    generatedAt: input.generatedAt,
    stale: currentCommit !== input.sourceCommit,
    graphTruth: false,
    runtimeProof: false,
  };
}
