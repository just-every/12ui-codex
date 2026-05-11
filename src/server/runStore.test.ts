import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { addDesign, addRunEvent, createRunRecord, readRun, runDir } from './runStore.js';

const runDirs: string[] = [];

describe('runStore', () => {
  afterEach(async () => {
    await Promise.all(runDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('persists run events and generated designs', async () => {
    const run = await createRunRecord({
      prompt: 'Test',
      batchSize: 1,
      aspect: 'portrait',
      quality: 'medium',
    });
    runDirs.push(runDir(run.id));
    await addRunEvent(run.id, {
      type: 'planning',
      message: 'Planning',
      progress: 0.25,
    });
    await addDesign(run.id, {
      id: 'design-1',
      branchIndex: 1,
      title: 'Design 1',
      prompt: 'Prompt',
      assetPath: 'assets/design-1.png',
      model: 'codex-gpt-image-2',
      createdAt: new Date().toISOString(),
    });

    const persisted = await readRun(run.id);
    expect(persisted.events).toHaveLength(1);
    expect(persisted.designs[0]?.id).toBe('design-1');
  });
});
