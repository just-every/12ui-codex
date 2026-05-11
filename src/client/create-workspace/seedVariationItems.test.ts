import { describe, expect, it } from 'vitest';
import type { DesignRun } from '../../shared/types.js';
import { buildSeedVariationItems } from './seedVariationItems.js';

const design = (branchIndex: number, title = `Design ${branchIndex}`): DesignRun['designs'][number] => ({
  id: `design-${branchIndex}`,
  branchIndex,
  title,
  prompt: `Prompt ${branchIndex}`,
  assetPath: `assets/design-${branchIndex}.png`,
  model: 'codex-gpt-image-2',
  createdAt: '2026-05-11T00:00:00.000Z',
});

const run = (designs: DesignRun['designs'], status: DesignRun['status'] = 'running'): DesignRun => ({
  id: 'run-1',
  status,
  prompt: 'Seed variation test',
  batchSize: 6,
  aspect: 'portrait',
  quality: 'medium',
  creativityMode: 'standard',
  textModel: 'codex-gpt-5.5-high',
  imageModel: 'codex-gpt-image-2',
  progress: status === 'completed' ? 1 : 0.6,
  error: null,
  events: [],
  plannedDesigns: Array.from({ length: 6 }, (_, index) => ({
    branchIndex: index + 1,
    title: `Planned ${index + 1}`,
    prompt: `Planned prompt ${index + 1}`,
  })),
  designs,
  handovers: [],
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
});

describe('seed variation items', () => {
  it('keeps out-of-order generated designs in branch slots while the run is active', () => {
    const items = buildSeedVariationItems({
      draftSeedVariationCount: 6,
      isSeedRunActive: true,
      seedRun: run([design(6), design(4), design(3), design(5)]),
      workspaceSeedVariationCount: 6,
    });

    expect(items.map((item) => item.id)).toEqual([
      'pending-1',
      'pending-2',
      'design-3',
      'design-4',
      'design-5',
      'design-6',
    ]);
    expect(items.map((item) => item.plannedTitle)).toEqual([
      'Planned 1',
      'Planned 2',
      'Planned 3',
      'Planned 4',
      'Planned 5',
      'Planned 6',
    ]);
  });

  it('does not render pending placeholders after completion', () => {
    const items = buildSeedVariationItems({
      draftSeedVariationCount: 6,
      isSeedRunActive: false,
      seedRun: run([design(6), design(4), design(3)], 'completed'),
      workspaceSeedVariationCount: 6,
    });

    expect(items.map((item) => item.id)).toEqual(['design-3', 'design-4', 'design-6']);
  });
});
