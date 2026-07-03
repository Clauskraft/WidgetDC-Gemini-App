import { describe, expect, it } from 'vitest';
import { createKnowledgePackManifest } from './knowledgePackFactory';

describe('createKnowledgePackManifest', () => {
  it('creates diagnostic-only manifests from anchored evidence', () => {
    const manifest = createKnowledgePackManifest({
      sourceCommit: '1c4a9615b40e',
      sourceWindow: ['docs/frontend/openwiki-pageagent-toolbox.md'],
      contentHash: 'sha256:abc123',
      generatedAt: '2026-07-04T00:00:00.000Z',
    });

    expect(manifest.boundary).toBe('diagnostic');
    expect(manifest.graphTruth).toBe(false);
    expect(manifest.runtimeProof).toBe(false);
    expect(manifest.sourceWindow).toEqual(['docs/frontend/openwiki-pageagent-toolbox.md']);
  });

  it('marks the pack stale when the source commit changes', () => {
    const manifest = createKnowledgePackManifest({
      sourceCommit: '1c4a9615b40e',
      sourceWindow: ['docs/frontend/openwiki-pageagent-toolbox.md'],
      contentHash: 'sha256:abc123',
      generatedAt: '2026-07-04T00:00:00.000Z',
      currentCommit: 'different-commit',
    });

    expect(manifest.stale).toBe(true);
  });
});
