import { describe, expect, it } from 'vitest';
import type { DesignOutput } from './types.js';
import {
  designImageHistory,
  resolveDesignAssetPath,
  resolveDesignHistoryIndex,
  resolveDesignRevisionSource,
} from './designImageRevision.js';

const design = {
  id: 'design-1',
  branchIndex: 1,
  title: 'Design',
  prompt: 'Prompt',
  assetPath: 'assets/base.png',
  model: 'codex-gpt-image-2',
  createdAt: '2026-05-11T00:00:00.000Z',
  revisions: [
    {
      id: 'revision-1',
      kind: 'edit',
      assetPath: 'assets/edit.png',
      prompt: 'Make it darker',
      model: 'codex-gpt-image-2',
      sourceRevisionId: null,
      sourceAssetPath: 'assets/base.png',
      createdAt: '2026-05-11T00:01:00.000Z',
    },
  ],
} satisfies DesignOutput;

describe('design image revision helpers', () => {
  it('uses the base image when no active revision is selected', () => {
    expect(resolveDesignAssetPath(design)).toBe('assets/base.png');
    expect(resolveDesignHistoryIndex(design)).toBe(0);
    expect(designImageHistory(design).map((entry) => entry.assetPath)).toEqual([
      'assets/base.png',
      'assets/edit.png',
    ]);
  });

  it('uses the active revision asset when selected', () => {
    const active = { ...design, activeRevisionId: 'revision-1' };
    expect(resolveDesignAssetPath(active)).toBe('assets/edit.png');
    expect(resolveDesignHistoryIndex(active)).toBe(1);
    expect(resolveDesignRevisionSource(active, 'revision-1').assetPath).toBe('assets/edit.png');
  });

  it('throws when persisted active revision state points at a missing revision', () => {
    expect(() => resolveDesignAssetPath({ ...design, activeRevisionId: 'missing' })).toThrow(
      'Active revision missing was not found',
    );
  });
});
