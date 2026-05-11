import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
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

const workspaceDirs: string[] = [];

describe('workspaceStore', () => {
  afterEach(async () => {
    await Promise.all(workspaceDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('persists seed state and planned pages', async () => {
    const workspace = await createWorkspace({
      prompt: 'Design the 12ui dashboard',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 3,
      aspect: 'portrait',
      quality: 'medium',
    });
    workspaceDirs.push(workspaceDir(workspace.id));

    await setWorkspaceSeedRun(workspace.id, 'seed-run-1');
    await setWorkspaceSeedSelection(workspace.id, 'design-1');
    await setWorkspacePages(workspace.id, [
      { id: 'home-1', title: 'Home', prompt: 'A home page', order: 1 },
      { id: 'settings-2', title: 'Settings', prompt: 'A settings page', order: 2, variationCount: 6 },
    ]);
    await setWorkspacePageRun(workspace.id, 'settings-2', 'settings-run-1');
    await patchWorkspacePage(workspace.id, 'settings-2', { selectedVariationId: 'design-2', status: 'ready' });

    const persisted = await readWorkspace(workspace.id);
    expect(persisted.seedRunId).toBe('seed-run-1');
    expect(persisted.selectedSeedDesignId).toBe('design-1');
    expect(persisted.pages).toHaveLength(2);
    expect(persisted.pages[1]).toMatchObject({
      id: 'settings-2',
      runId: 'settings-run-1',
      selectedVariationId: 'design-2',
      variationCount: 6,
      status: 'ready',
    });
  });
});
