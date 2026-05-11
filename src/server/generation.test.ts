import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateRunRequest } from '../shared/types.js';
import { createRunRecord, readRun, runDir } from './runStore.js';
import { startGeneration } from './generation.js';

const mocks = vi.hoisted(() => ({
  planDesignIdeas: vi.fn(),
  planIndividualDesignPrompts: vi.fn(),
  generateDesignImageDataUrl: vi.fn(),
}));

vi.mock('./designPlanning/ideaPlanner.js', () => ({
  planDesignIdeas: mocks.planDesignIdeas,
}));

vi.mock('./designPlanning/individualDesignPlanner.js', () => ({
  planIndividualDesignPrompts: mocks.planIndividualDesignPrompts,
}));

vi.mock('./ensembleImage.js', () => ({
  generateDesignImageDataUrl: mocks.generateDesignImageDataUrl,
}));

const createdRunDirs: string[] = [];

const request: CreateRunRequest = {
  prompt: 'Create a premium coffee checkout.',
  sketchDataUrl: null,
  referenceDataUrls: [],
  batchSize: 3,
  aspect: 'portrait',
  quality: 'medium',
};

describe('generation planning orchestration', () => {
  beforeEach(() => {
    mocks.planDesignIdeas.mockReset();
    mocks.planIndividualDesignPrompts.mockReset();
    mocks.generateDesignImageDataUrl.mockReset();

    mocks.planDesignIdeas.mockResolvedValue([
      {
        branchIndex: 1,
        title: 'Coffee Checkout',
        direction: 'Straightforward checkout screen.',
        creativeDistance: 0,
        intent: 'Implement the prompt plainly.',
      },
      {
        branchIndex: 2,
        title: 'Barista Checkout',
        direction: 'Counter-service interpretation.',
        creativeDistance: 1,
        intent: 'Make the checkout feel more tactile.',
      },
      {
        branchIndex: 3,
        title: 'Subscription Ritual Checkout',
        direction: 'Membership-flow interpretation.',
        creativeDistance: 2,
        intent: 'Push toward a more editorial premium flow.',
      },
    ]);

    mocks.planIndividualDesignPrompts.mockResolvedValue([
      {
        branchIndex: 1,
        title: 'Coffee Checkout',
        interpretation: 'Plain checkout.',
        prompt: 'Prompt A',
      },
      {
        branchIndex: 2,
        title: 'Barista Checkout',
        interpretation: 'Counter checkout.',
        prompt: 'Prompt B',
      },
      {
        branchIndex: 3,
        title: 'Subscription Ritual Checkout',
        interpretation: 'Subscription checkout.',
        prompt: 'Prompt C',
      },
    ]);

    mocks.generateDesignImageDataUrl.mockResolvedValue('data:image/png;base64,aGVsbG8=');
  });

  afterEach(async () => {
    await Promise.all(createdRunDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('plans ideas once, plans each design prompt, and generates from final prompts', async () => {
    const run = await createRunRecord(request);
    createdRunDirs.push(runDir(run.id));

    await startGeneration(run.id, request);

    expect(mocks.planDesignIdeas).toHaveBeenCalledTimes(1);
    expect(mocks.planDesignIdeas).toHaveBeenCalledWith(request);
    expect(mocks.planIndividualDesignPrompts).toHaveBeenCalledTimes(1);
    expect(mocks.planIndividualDesignPrompts).toHaveBeenCalledWith(request, await mocks.planDesignIdeas.mock.results[0]?.value);
    expect(mocks.generateDesignImageDataUrl).toHaveBeenCalledTimes(3);
    expect(mocks.generateDesignImageDataUrl.mock.calls.map((call) => call[0].prompt)).toEqual([
      'Prompt A',
      'Prompt B',
      'Prompt C',
    ]);

    const persisted = await readRun(run.id);
    expect(persisted.status).toBe('completed');
    expect(persisted.plannedDesigns.map((design) => design.prompt)).toEqual(['Prompt A', 'Prompt B', 'Prompt C']);
    expect(persisted.designs.map((design) => design.prompt)).toEqual(['Prompt A', 'Prompt B', 'Prompt C']);
    expect(JSON.parse(await readFile(path.join(runDir(run.id), 'idea-plan.json'), 'utf8'))).toHaveLength(3);
    expect(JSON.parse(await readFile(path.join(runDir(run.id), 'design-prompts.json'), 'utf8'))).toHaveLength(3);
  });
});
