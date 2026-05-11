import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateRunRequest } from '../shared/types.js';
import { createRunRecord, readRun, runDir } from './runStore.js';
import { startGeneration } from './generation.js';

const mocks = vi.hoisted(() => ({
  planDesignIdeas: vi.fn(),
  planIndividualDesignPrompt: vi.fn(),
  generateDesignImageDataUrl: vi.fn(),
}));

vi.mock('./designPlanning/ideaPlanner.js', () => ({
  planDesignIdeas: mocks.planDesignIdeas,
}));

vi.mock('./designPlanning/individualDesignPlanner.js', () => ({
  planIndividualDesignPrompt: mocks.planIndividualDesignPrompt,
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
  creativityMode: 'standard',
};

const ideaPlan = [
  {
    branchIndex: 1,
    name: 'Coffee Checkout',
    direction: 'Straightforward checkout screen.',
    description: 'Plain checkout implementation.',
    header: 'Compact coffee shop header.',
    primaryCta: 'Clear pay button.',
    supportingUi: 'Cart summary and payment form.',
    imagery: 'Coffee product thumbnails.',
    tone: 'Warm and direct.',
    differentFromPrevious: 'Baseline branch: a straightforward checkout.',
    avoidOverlapWithOtherBranches: 'Avoid cafe-counter or membership ritual metaphors.',
    creativeDistance: 0,
    intent: 'Implement the prompt plainly.',
  },
  {
    branchIndex: 2,
    name: 'Barista Checkout',
    direction: 'Counter-service interpretation.',
    description: 'Counter-service checkout direction.',
    header: 'Cafe counter header.',
    primaryCta: 'Receipt-style checkout action.',
    supportingUi: 'Pickup details and loyalty module.',
    imagery: 'Barista counter details.',
    tone: 'Tactile and lively.',
    differentFromPrevious: 'Uses a cafe counter metaphor instead of a standard checkout form.',
    avoidOverlapWithOtherBranches: 'Avoid plain payment-form hierarchy and premium subscription editorial styling.',
    creativeDistance: 1,
    intent: 'Make the checkout feel more tactile.',
  },
  {
    branchIndex: 3,
    name: 'Subscription Ritual Checkout',
    direction: 'Membership-flow interpretation.',
    description: 'Premium membership checkout direction.',
    header: 'Editorial membership header.',
    primaryCta: 'Premium subscribe action.',
    supportingUi: 'Plan comparison and benefit panels.',
    imagery: 'Premium coffee ritual visuals.',
    tone: 'Elevated and editorial.',
    differentFromPrevious: 'Moves from tactile counter service into premium membership storytelling.',
    avoidOverlapWithOtherBranches: 'Avoid receipt-stamp CTAs, cafe counter cues, and standard cart-summary dominance.',
    creativeDistance: 2,
    intent: 'Push toward a more editorial premium flow.',
  },
];

const designPrompts = [
  {
    branchIndex: 1,
    title: 'Coffee Checkout',
    interpretation: 'Plain checkout.',
    directionFidelity: 'Preserves the warm direct checkout branch.',
    visualDifferentiators: ['compact coffee header', 'clear pay button'],
    prompt: 'Prompt A',
  },
  {
    branchIndex: 2,
    title: 'Barista Checkout',
    interpretation: 'Counter checkout.',
    directionFidelity: 'Preserves the tactile cafe counter branch.',
    visualDifferentiators: ['receipt action', 'pickup module'],
    prompt: 'Prompt B',
  },
  {
    branchIndex: 3,
    title: 'Subscription Ritual Checkout',
    interpretation: 'Subscription checkout.',
    directionFidelity: 'Preserves the premium editorial membership branch.',
    visualDifferentiators: ['editorial header', 'plan comparison panels'],
    prompt: 'Prompt C',
  },
];

const waitForCondition = async (condition: () => boolean): Promise<void> => {
  const deadline = Date.now() + 1000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('generation planning orchestration', () => {
  beforeEach(() => {
    mocks.planDesignIdeas.mockReset();
    mocks.planIndividualDesignPrompt.mockReset();
    mocks.generateDesignImageDataUrl.mockReset();

    mocks.planDesignIdeas.mockResolvedValue(ideaPlan);
    mocks.planIndividualDesignPrompt.mockImplementation(async (_request, idea) => (
      designPrompts.find((designPrompt) => designPrompt.branchIndex === idea.branchIndex)
    ));

    mocks.generateDesignImageDataUrl.mockResolvedValue('data:image/png;base64,aGVsbG8=');
  });

  afterEach(async () => {
    await Promise.all(createdRunDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('plans ideas once, plans each design prompt, and generates from final prompts', async () => {
    const run = await createRunRecord(request);
    createdRunDirs.push(runDir(run.id));
    mocks.planIndividualDesignPrompt.mockImplementation(async (_request, idea) => {
      const promptingRun = await readRun(run.id);
      expect(promptingRun.plannedDesigns.map((design) => design.title)).toEqual([
        'Coffee Checkout',
        'Barista Checkout',
        'Subscription Ritual Checkout',
      ]);
      expect(promptingRun.plannedDesigns.map((design) => design.prompt)).toEqual([
        'Straightforward checkout screen.',
        'Counter-service interpretation.',
        'Membership-flow interpretation.',
      ]);
      return designPrompts.find((designPrompt) => designPrompt.branchIndex === idea.branchIndex);
    });

    await startGeneration(run.id, request);

    expect(mocks.planDesignIdeas).toHaveBeenCalledTimes(1);
    expect(mocks.planDesignIdeas).toHaveBeenCalledWith(request);
    expect(mocks.planIndividualDesignPrompt).toHaveBeenCalledTimes(3);
    expect(mocks.planIndividualDesignPrompt.mock.calls.map((call) => call[1].branchIndex)).toEqual([1, 2, 3]);
    expect(mocks.generateDesignImageDataUrl).toHaveBeenCalledTimes(3);
    expect(mocks.generateDesignImageDataUrl.mock.calls.map((call) => call[0].prompt).sort()).toEqual([
      'Prompt A',
      'Prompt B',
      'Prompt C',
    ]);

    const persisted = await readRun(run.id);
    expect(persisted.status).toBe('completed');
    expect(persisted.plannedDesigns.map((design) => design.prompt)).toEqual(['Prompt A', 'Prompt B', 'Prompt C']);
    expect(persisted.designs.map((design) => design.prompt).sort()).toEqual(['Prompt A', 'Prompt B', 'Prompt C']);
    expect(persisted.events.map((event) => event.type)).toContain('prompting');
    expect(JSON.parse(await readFile(path.join(runDir(run.id), 'idea-plan.json'), 'utf8'))).toHaveLength(3);
    expect(JSON.parse(await readFile(path.join(runDir(run.id), 'design-prompts.json'), 'utf8'))).toHaveLength(3);
  });

  it('starts rendering a branch as soon as that branch prompt is ready', async () => {
    const run = await createRunRecord(request);
    createdRunDirs.push(runDir(run.id));
    let resolvePromptB: (value: typeof designPrompts[number]) => void = () => undefined;
    let resolvePromptC: (value: typeof designPrompts[number]) => void = () => undefined;
    const promptB = new Promise<typeof designPrompts[number]>((resolve) => { resolvePromptB = resolve; });
    const promptC = new Promise<typeof designPrompts[number]>((resolve) => { resolvePromptC = resolve; });
    mocks.planIndividualDesignPrompt.mockImplementation((_request, idea) => {
      if (idea.branchIndex === 1) return Promise.resolve(designPrompts[0]);
      if (idea.branchIndex === 2) return promptB;
      return promptC;
    });

    const generation = startGeneration(run.id, request);
    await waitForCondition(() => mocks.generateDesignImageDataUrl.mock.calls.length === 1);

    expect(mocks.planIndividualDesignPrompt).toHaveBeenCalledTimes(3);
    expect(mocks.generateDesignImageDataUrl.mock.calls[0]?.[0].prompt).toBe('Prompt A');

    resolvePromptB(designPrompts[1]);
    resolvePromptC(designPrompts[2]);
    await generation;

    expect(mocks.generateDesignImageDataUrl.mock.calls[0]?.[0].prompt).toBe('Prompt A');
    expect(mocks.generateDesignImageDataUrl.mock.calls.map((call) => call[0].prompt).sort()).toEqual([
      'Prompt A',
      'Prompt B',
      'Prompt C',
    ]);
  });
});
