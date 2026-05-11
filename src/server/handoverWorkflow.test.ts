import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandoverResult } from '../shared/types.js';
import { addDesign, createRunRecord, readRun, runDir, setRunStatus } from './runStore.js';
import { checkConnection } from './connection.js';
import { readCodexBridgeEvents } from './codexBridge.js';
import {
  createPageHandover,
  createSeedHandover,
  maybeStartSeedHandover,
} from './handoverWorkflow.js';
import {
  createWorkspace,
  patchWorkspacePage,
  readWorkspace,
  setWorkspacePageRun,
  setWorkspacePages,
  setWorkspaceSeedRun,
  setWorkspaceSeedSelection,
  workspaceDir,
} from './workspaceStore.js';

const mocks = vi.hoisted(() => ({
  submitTwelveUiHandover: vi.fn(),
}));

vi.mock('./twelveUi.js', () => ({
  submitTwelveUiHandover: mocks.submitTwelveUiHandover,
}));

const runDirs: string[] = [];
const workspaceDirs: string[] = [];

const createCompletedRunWithDesign = async (designId: string) => {
  const run = await createRunRecord({
    prompt: 'Create release test UI.',
    batchSize: 1,
    aspect: 'portrait',
    quality: 'medium',
    creativityMode: 'standard',
  });
  runDirs.push(runDir(run.id));
  await addDesign(run.id, {
    id: designId,
    branchIndex: 1,
    title: 'Release Test Design',
    prompt: 'Prompt',
    assetPath: `assets/${designId}.png`,
    model: 'codex-gpt-image-2',
    createdAt: '2026-05-11T00:00:00.000Z',
  });
  await setRunStatus(run.id, 'completed', 1, null);
  return run;
};

const handoverFor = (runId: string, designId: string): HandoverResult => ({
  runId,
  designId,
  statusUrl: 'http://127.0.0.1:9918/api/design/extract-runs/extract-1',
  handoverUrl: `/api/runs/${runId}/handovers/${designId}/handover.md`,
  handoverHtmlUrl: `/api/runs/${runId}/handovers/${designId}/handover.html`,
  zipUrl: 'http://127.0.0.1:9918/api/design/extract-runs/extract-1/handover.zip',
  raw: { ok: true },
  createdAt: '2026-05-11T00:00:00.000Z',
});

describe('handover workflow', () => {
  beforeEach(() => {
    mocks.submitTwelveUiHandover.mockReset();
    mocks.submitTwelveUiHandover.mockImplementation(async (args: { runId: string; designId: string }) => (
      handoverFor(args.runId, args.designId)
    ));
  });

  afterEach(async () => {
    await Promise.all([
      ...runDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
      ...workspaceDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    ]);
  });

  it('creates seed handover docs, persists them, and emits all handover links', async () => {
    const workspace = await createWorkspace({
      prompt: 'Create release test UI.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 1,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
    workspaceDirs.push(workspaceDir(workspace.id));
    const run = await createCompletedRunWithDesign('design-1');
    await setWorkspaceSeedRun(workspace.id, run.id);
    await setWorkspaceSeedSelection(workspace.id, 'design-1');

    const result = await createSeedHandover(workspace.id);

    expect(result.handover).toMatchObject({
      runId: run.id,
      designId: 'design-1',
      statusUrl: expect.any(String),
      handoverUrl: expect.stringContaining('/handover.md'),
      handoverHtmlUrl: expect.stringContaining('/handover.html'),
      zipUrl: expect.any(String),
    });
    await expect(readWorkspace(workspace.id)).resolves.toMatchObject({
      seedHandover: {
        runId: run.id,
        designId: 'design-1',
      },
    });
    await expect(readRun(run.id)).resolves.toMatchObject({
      handovers: [expect.objectContaining({ designId: 'design-1' })],
    });
    const events = await readCodexBridgeEvents(workspace.id);
    expect(events.map((event) => event.type)).toEqual(['handover_started', 'handover_completed']);
    expect(events[1]?.payload).toMatchObject({
      statusUrl: expect.any(String),
      handoverUrl: expect.stringContaining('/handover.md'),
      handoverHtmlUrl: expect.stringContaining('/handover.html'),
      zipUrl: expect.any(String),
    });
  });

  it('creates page handovers for selected page variations', async () => {
    const workspace = await createWorkspace({
      prompt: 'Create release test UI.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 1,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
    workspaceDirs.push(workspaceDir(workspace.id));
    await setWorkspacePages(workspace.id, [
      { id: 'pricing-1', title: 'Pricing', prompt: 'Pricing page', order: 1 },
    ]);
    const run = await createCompletedRunWithDesign('design-2');
    await setWorkspacePageRun(workspace.id, 'pricing-1', run.id);
    await patchWorkspacePage(workspace.id, 'pricing-1', {
      selectedVariationId: 'design-2',
      status: 'ready',
      error: null,
    });

    const result = await createPageHandover(workspace.id, 'pricing-1');

    expect(result.workspace.pages[0]?.handover).toMatchObject({
      runId: run.id,
      designId: 'design-2',
      handoverHtmlUrl: expect.stringContaining('/handover.html'),
    });
    const events = await readCodexBridgeEvents(workspace.id);
    expect(events.map((event) => event.type)).toEqual(['handover_started', 'handover_completed']);
    expect(events[1]?.payload).toMatchObject({
      pageId: 'pricing-1',
      pageTitle: 'Pricing',
      handoverHtmlUrl: expect.stringContaining('/handover.html'),
    });
  });

  it('starts seed handover in the background when 12ui is connected', async () => {
    const workspace = await createWorkspace({
      prompt: 'Create release test UI.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 1,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
    workspaceDirs.push(workspaceDir(workspace.id));
    const run = await createCompletedRunWithDesign('design-3');
    await setWorkspaceSeedRun(workspace.id, run.id);
    await setWorkspaceSeedSelection(workspace.id, 'design-3');
    await checkConnection('http://127.0.0.1:9918', async () => new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    expect(maybeStartSeedHandover(workspace.id)).toBe(true);

    await vi.waitFor(async () => {
      await expect(readWorkspace(workspace.id)).resolves.toMatchObject({
        seedHandover: { designId: 'design-3' },
      });
    });
  });

  it('does not attach a stale seed handover when selection changes mid-export', async () => {
    const workspace = await createWorkspace({
      prompt: 'Create release test UI.',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 3,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
    workspaceDirs.push(workspaceDir(workspace.id));
    const run = await createCompletedRunWithDesign('design-a');
    await addDesign(run.id, {
      id: 'design-b',
      branchIndex: 2,
      title: 'Release Test Design B',
      prompt: 'Prompt B',
      assetPath: 'assets/design-b.png',
      model: 'codex-gpt-image-2',
      createdAt: '2026-05-11T00:00:00.000Z',
    });
    await setWorkspaceSeedRun(workspace.id, run.id);
    await setWorkspaceSeedSelection(workspace.id, 'design-a');
    const pending = new Map<string, () => void>();
    mocks.submitTwelveUiHandover.mockImplementation((args: { runId: string; designId: string }) => (
      new Promise<HandoverResult>((resolve) => {
        pending.set(args.designId, () => resolve(handoverFor(args.runId, args.designId)));
      })
    ));

    const staleHandover = createSeedHandover(workspace.id);
    await vi.waitFor(() => expect(pending.has('design-a')).toBe(true));
    await setWorkspaceSeedSelection(workspace.id, 'design-b');
    const currentHandover = createSeedHandover(workspace.id);
    await vi.waitFor(() => expect(pending.has('design-b')).toBe(true));

    pending.get('design-b')?.();
    await expect(currentHandover).resolves.toMatchObject({
      handover: { designId: 'design-b' },
    });
    pending.get('design-a')?.();
    await expect(staleHandover).rejects.toThrow('Seed selection changed before handover completed.');

    await expect(readWorkspace(workspace.id)).resolves.toMatchObject({
      selectedSeedDesignId: 'design-b',
      seedHandover: { designId: 'design-b' },
    });
    const events = await readCodexBridgeEvents(workspace.id);
    expect(events.filter((event) => event.type === 'handover_completed').map((event) => event.payload?.designId)).toEqual(['design-b']);
    expect(events.some((event) => event.type === 'handover_failed')).toBe(false);
  });
});
