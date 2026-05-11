import type { DesignOutput, HandoverResult, WorkspaceHandoverResponse } from '../shared/types.js';
import { resolveDesignAssetPath } from '../shared/designImageRevision.js';
import { emitCodexBridgeEvent } from './codexBridge.js';
import { getConnection } from './connection.js';
import { addHandover, readRun } from './runStore.js';
import { submitTwelveUiHandover } from './twelveUi.js';
import {
  patchWorkspacePage,
  readWorkspace,
  setWorkspacePageHandoverForSelection,
  setWorkspaceSeedHandoverForSelection,
  setWorkspaceStatus,
} from './workspaceStore.js';

const activeJobs = new Map<string, Promise<WorkspaceHandoverResponse>>();

class HandoverSupersededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandoverSupersededError';
  }
}

const isHandoverSupersededError = (error: unknown): error is HandoverSupersededError => (
  error instanceof HandoverSupersededError
);

const handoverLinksPayload = (handover: HandoverResult): Record<string, unknown> => ({
  statusUrl: handover.statusUrl,
  handoverUrl: handover.handoverUrl,
  handoverHtmlUrl: handover.handoverHtmlUrl,
  zipUrl: handover.zipUrl,
});

export const isTwelveUiReadyForAutoHandover = (): boolean => {
  const connection = getConnection();
  return connection.status === 'ok' && Boolean(connection.auth?.configured);
};

const runExclusive = (
  key: string,
  createJob: () => Promise<WorkspaceHandoverResponse>,
): Promise<WorkspaceHandoverResponse> => {
  const active = activeJobs.get(key);
  if (active) return active;
  const job = createJob().finally(() => {
    activeJobs.delete(key);
  });
  activeJobs.set(key, job);
  return job;
};

const submitDesignHandover = async (args: {
  workspaceId: string;
  runId: string;
  design: DesignOutput;
  pageId?: string;
  pageTitle?: string;
}): Promise<HandoverResult> => {
  const assetPath = resolveDesignAssetPath(args.design);
  await emitCodexBridgeEvent({
    workspaceId: args.workspaceId,
    type: 'handover_started',
    message: args.pageTitle
      ? `Started handover for ${args.pageTitle}: ${args.design.title}.`
      : `Started handover for seed design: ${args.design.title}.`,
    payload: {
      ...(args.pageId ? { pageId: args.pageId, pageTitle: args.pageTitle } : {}),
      runId: args.runId,
      designId: args.design.id,
      title: args.design.title,
      assetPath,
    },
  });
  return submitTwelveUiHandover({
    runId: args.runId,
    designId: args.design.id,
    assetPath,
  });
};

export const createSeedHandover = async (workspaceId: string): Promise<WorkspaceHandoverResponse> => {
  const initialWorkspace = await readWorkspace(workspaceId);
  if (!initialWorkspace.seedRunId || !initialWorkspace.selectedSeedDesignId) {
    throw new Error('Select a seed design before handover.');
  }
  const expectedRunId = initialWorkspace.seedRunId;
  const expectedDesignId = initialWorkspace.selectedSeedDesignId;
  return runExclusive(`seed:${workspaceId}:${expectedRunId}:${expectedDesignId}`, async () => {
    const workspace = await readWorkspace(workspaceId);
    if (workspace.seedRunId !== expectedRunId || workspace.selectedSeedDesignId !== expectedDesignId) {
      throw new HandoverSupersededError('Seed selection changed before handover started.');
    }
    if (workspace.seedHandover?.designId === expectedDesignId) {
      return { workspace, handover: workspace.seedHandover };
    }
    const run = await readRun(expectedRunId);
    const design = run.designs.find((entry) => entry.id === expectedDesignId);
    if (!design) throw new Error('Selected seed design was not found.');
    try {
      const handover = await submitDesignHandover({
        workspaceId,
        runId: run.id,
        design,
      });
      const currentWorkspace = await readWorkspace(workspaceId);
      if (currentWorkspace.seedRunId !== run.id || currentWorkspace.selectedSeedDesignId !== design.id) {
        throw new HandoverSupersededError('Seed selection changed before handover completed.');
      }
      await addHandover(run.id, handover);
      const nextWorkspace = await setWorkspaceSeedHandoverForSelection(workspaceId, design.id, handover);
      await emitCodexBridgeEvent({
        workspaceId,
        type: 'handover_completed',
        message: `Handover ready for seed design: ${design.title}.`,
        payload: {
          runId: run.id,
          designId: design.id,
          title: design.title,
          ...handoverLinksPayload(handover),
        },
      });
      return { workspace: nextWorkspace, handover };
    } catch (error) {
      if (isHandoverSupersededError(error)) throw error;
      const message = error instanceof Error ? error.message : String(error || 'Handover failed.');
      await setWorkspaceStatus(workspaceId, 'ready', message);
      await emitCodexBridgeEvent({
        workspaceId,
        type: 'handover_failed',
        message: `Handover failed for seed design: ${message}`,
        payload: {
          runId: run.id,
          designId: design.id,
          title: design.title,
          error: message,
        },
      });
      throw error;
    }
  });
};

export const createPageHandover = async (
  workspaceId: string,
  pageId: string,
): Promise<WorkspaceHandoverResponse> => {
  const initialWorkspace = await readWorkspace(workspaceId);
  const initialPage = initialWorkspace.pages.find((entry) => entry.id === pageId);
  if (!initialPage) throw new Error('Workspace page not found.');
  if (!initialPage.runId || !initialPage.selectedVariationId) {
    throw new Error('Select a page variation before handover.');
  }
  const expectedRunId = initialPage.runId;
  const expectedDesignId = initialPage.selectedVariationId;
  return runExclusive(`page:${workspaceId}:${pageId}:${expectedRunId}:${expectedDesignId}`, async () => {
    const workspace = await readWorkspace(workspaceId);
    const page = workspace.pages.find((entry) => entry.id === pageId);
    if (!page) throw new Error('Workspace page not found.');
    if (page.runId !== expectedRunId || page.selectedVariationId !== expectedDesignId) {
      throw new HandoverSupersededError('Page variation selection changed before handover started.');
    }
    if (page.handover?.designId === expectedDesignId) {
      return { workspace, handover: page.handover };
    }
    const run = await readRun(expectedRunId);
    const design = run.designs.find((entry) => entry.id === expectedDesignId);
    if (!design) throw new Error('Selected page variation was not found.');
    try {
      const handover = await submitDesignHandover({
        workspaceId,
        pageId,
        pageTitle: page.title,
        runId: run.id,
        design,
      });
      const currentWorkspace = await readWorkspace(workspaceId);
      const currentPage = currentWorkspace.pages.find((entry) => entry.id === pageId);
      if (!currentPage || currentPage.runId !== run.id || currentPage.selectedVariationId !== design.id) {
        throw new HandoverSupersededError('Page variation selection changed before handover completed.');
      }
      await addHandover(run.id, handover);
      const nextWorkspace = await setWorkspacePageHandoverForSelection(workspaceId, pageId, design.id, handover);
      await emitCodexBridgeEvent({
        workspaceId,
        type: 'handover_completed',
        message: `Handover ready for ${page.title}: ${design.title}.`,
        payload: {
          pageId,
          pageTitle: page.title,
          runId: run.id,
          designId: design.id,
          title: design.title,
          ...handoverLinksPayload(handover),
        },
      });
      return { workspace: nextWorkspace, handover };
    } catch (error) {
      if (isHandoverSupersededError(error)) throw error;
      const message = error instanceof Error ? error.message : String(error || 'Handover failed.');
      await patchWorkspacePage(workspaceId, pageId, { error: message });
      await emitCodexBridgeEvent({
        workspaceId,
        type: 'handover_failed',
        message: `Handover failed for ${page.title}: ${message}`,
        payload: {
          pageId,
          pageTitle: page.title,
          runId: run.id,
          designId: design.id,
          title: design.title,
          error: message,
        },
      });
      throw error;
    }
  });
};

export const maybeStartSeedHandover = (workspaceId: string): boolean => {
  if (!isTwelveUiReadyForAutoHandover()) return false;
  void createSeedHandover(workspaceId).catch((error) => {
    if (isHandoverSupersededError(error)) return;
    console.error(`Background seed handover failed for workspace ${workspaceId}:`, error);
  });
  return true;
};

export const maybeStartPageHandover = (workspaceId: string, pageId: string): boolean => {
  if (!isTwelveUiReadyForAutoHandover()) return false;
  void createPageHandover(workspaceId, pageId).catch((error) => {
    if (isHandoverSupersededError(error)) return;
    console.error(`Background page handover failed for workspace ${workspaceId} page ${pageId}:`, error);
  });
  return true;
};
