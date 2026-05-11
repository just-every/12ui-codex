import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateRunRequest, HandoverResult } from '../shared/types.js';
import { addDesign, runDir, setRunStatus } from './runStore.js';
import { runDirectCreateHandover } from './directWorkflow.js';

const mocks = vi.hoisted(() => ({
  startGeneration: vi.fn(),
  submitTwelveUiHandover: vi.fn(),
  ensembleRequest: vi.fn((messages: unknown, agent: unknown) => ({ messages, agent })),
  ensembleResult: vi.fn(),
}));

vi.mock('./generation.js', () => ({
  startGeneration: mocks.startGeneration,
}));

vi.mock('./twelveUi.js', () => ({
  submitTwelveUiHandover: mocks.submitTwelveUiHandover,
}));

vi.mock('@just-every/ensemble', () => ({
  ensembleRequest: mocks.ensembleRequest,
  ensembleResult: mocks.ensembleResult,
}));

const createdRunDirs: string[] = [];
const observedGenerationRequests: CreateRunRequest[] = [];

const selectedCandidateFromPickerRequest = (request: unknown): string => {
  const record = request as {
    messages?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };
  const text = record.messages?.[0]?.content?.[0]?.text ?? '';
  const match = /candidateId: ([^\n]+)/.exec(text);
  if (!match?.[1]) throw new Error('Picker request did not include a candidateId.');
  return match[1];
};

describe('direct workflow', () => {
  beforeEach(() => {
    mocks.startGeneration.mockReset();
    mocks.submitTwelveUiHandover.mockReset();
    mocks.ensembleRequest.mockClear();
    mocks.ensembleResult.mockReset();
    observedGenerationRequests.length = 0;

    mocks.startGeneration.mockImplementation(async (runId: string, request: CreateRunRequest) => {
      createdRunDirs.push(runDir(runId));
      observedGenerationRequests.push(request);
      await Promise.all(Array.from({ length: request.batchSize }, async (_, index) => {
        const branchIndex = index + 1;
        await addDesign(runId, {
          id: `design-${branchIndex}`,
          branchIndex,
          title: `Design ${branchIndex}`,
          prompt: `Prompt ${branchIndex}`,
          assetPath: `assets/design-${branchIndex}.png`,
          model: 'codex-gpt-image-2',
          createdAt: new Date().toISOString(),
        });
      }));
      await setRunStatus(runId, 'completed', 1, null);
    });

    mocks.ensembleResult.mockImplementation(async (request: unknown) => ({
      message: JSON.stringify({
        candidateId: selectedCandidateFromPickerRequest(request),
        reason: 'Best generated interface.',
      }),
    }));

    mocks.submitTwelveUiHandover.mockImplementation(async (args: {
      runId: string;
      designId: string;
    }) => ({
      runId: args.runId,
      designId: args.designId,
      raw: { ok: true },
      createdAt: new Date().toISOString(),
    } satisfies HandoverResult));
  });

  afterEach(async () => {
    await Promise.all(createdRunDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('generates direct handover candidates in one shared planner run', async () => {
    const result = await runDirectCreateHandover({
      prompt: 'Create a clean analytics dashboard.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      designCount: 6,
      aspect: 'landscape',
      quality: 'medium',
      creativityMode: 'creative',
    });

    expect(mocks.startGeneration).toHaveBeenCalledTimes(1);
    expect(observedGenerationRequests).toEqual([{
      prompt: 'Create a clean analytics dashboard.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      batchSize: 6,
      aspect: 'landscape',
      quality: 'medium',
      creativityMode: 'creative',
    }]);
    expect(observedGenerationRequests[0]?.prompt).not.toContain('Generate batch');
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]?.designs).toHaveLength(6);
    expect(result.selected.designId).toBe('design-1');
  });
});
