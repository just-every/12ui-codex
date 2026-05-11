import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import {
  emitCodexBridgeEvent,
  getCodexBridgeStatus,
  readCodexBridgeEvents,
  waitForCodexBridgeEvent,
} from './codexBridge.js';
import { createWorkspace, workspaceDir } from './workspaceStore.js';

const workspaceDirs: string[] = [];

describe('codexBridge', () => {
  afterEach(async () => {
    await Promise.all(workspaceDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('marks Codex as waiting until a matching event arrives', async () => {
    const workspace = await createWorkspace({
      prompt: 'Design a page',
      sketchDataUrl: null,
      referenceDataUrls: [],
      seedVariationCount: 3,
      aspect: 'portrait',
      quality: 'medium',
    });
    workspaceDirs.push(workspaceDir(workspace.id));

    const request = new EventEmitter() as unknown as IncomingMessage;
    const wait = waitForCodexBridgeEvent(
      workspace.id,
      ['seed_design_selected'],
      1_000,
      request,
    );

    expect(getCodexBridgeStatus(workspace.id).isWaiting).toBe(true);

    const emitted = await emitCodexBridgeEvent({
      workspaceId: workspace.id,
      type: 'seed_design_selected',
      message: 'Seed design selected.',
      payload: { runId: 'run-1', designId: 'design-1' },
    });
    const result = await wait;

    expect(result.status).toBe('event');
    expect(result.event).toMatchObject({ id: emitted.id, type: 'seed_design_selected' });
    expect(result.bridgeStatus.isWaiting).toBe(false);
    await expect(readCodexBridgeEvents(workspace.id)).resolves.toEqual([emitted]);
  });
});
