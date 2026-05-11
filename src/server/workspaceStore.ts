import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  CreateWorkspace,
  CreateWorkspacePage,
  CreateWorkspaceRequest,
  CreateWorkspaceStatus,
  DirectDesignCount,
  HandoverResult,
} from '../shared/types.js';
import { runsRoot } from './config.js';
import { normalizeCreativityMode } from './validation.js';

type WorkspacePatch = Partial<Omit<CreateWorkspace, 'id' | 'createdAt'>>;
type PagePatch = Partial<Omit<CreateWorkspacePage, 'id' | 'order'>>;

const listeners = new Map<string, Set<(workspace: CreateWorkspace) => void>>();

const nowIso = (): string => new Date().toISOString();

export const workspacesRoot = path.join(runsRoot, 'workspaces');
export const workspaceDir = (workspaceId: string): string => path.join(workspacesRoot, workspaceId);
export const workspaceJsonPath = (workspaceId: string): string => path.join(workspaceDir(workspaceId), 'workspace.json');

export const ensureWorkspacesRoot = async (): Promise<void> => {
  await mkdir(workspacesRoot, { recursive: true });
};

export const createWorkspace = async (request: CreateWorkspaceRequest): Promise<CreateWorkspace> => {
  await ensureWorkspacesRoot();
  const id = randomUUID();
  const createdAt = nowIso();
  const workspace: CreateWorkspace = {
    id,
    status: 'idle',
    prompt: request.prompt,
    sketchDataUrl: request.sketchDataUrl,
    referenceDataUrls: request.referenceDataUrls,
    aspect: request.aspect,
    quality: request.quality,
    creativityMode: request.creativityMode,
    seedVariationCount: request.seedVariationCount ?? 3,
    seedRunIds: [],
    seedRunId: null,
    selectedSeedDesignId: null,
    seedHandover: null,
    plannerVisible: false,
    plannerPrompt: '',
    pages: [],
    error: null,
    createdAt,
    updatedAt: createdAt,
  };
  await mkdir(workspaceDir(id), { recursive: true });
  return writeWorkspace(workspace);
};

const normalizeRunIds = (runIds: unknown, activeRunId: string | null): string[] => {
  const normalized = Array.isArray(runIds)
    ? runIds.filter((runId): runId is string => typeof runId === 'string' && runId.trim().length > 0)
    : [];
  return activeRunId && !normalized.includes(activeRunId)
    ? [...normalized, activeRunId]
    : normalized;
};

const normalizePage = (page: CreateWorkspacePage): CreateWorkspacePage => ({
  ...page,
  runIds: normalizeRunIds(page.runIds, page.runId),
});

const normalizeWorkspace = (workspace: CreateWorkspace): CreateWorkspace => ({
  ...workspace,
  creativityMode: normalizeCreativityMode(workspace.creativityMode),
  seedRunIds: normalizeRunIds(workspace.seedRunIds, workspace.seedRunId),
  seedHandover: workspace.seedHandover ?? null,
  plannerVisible: workspace.plannerVisible ?? false,
  plannerPrompt: workspace.plannerPrompt ?? '',
  pages: (workspace.pages ?? []).map(normalizePage),
});

export const readWorkspace = async (workspaceId: string): Promise<CreateWorkspace> => {
  const raw = await readFile(workspaceJsonPath(workspaceId), 'utf8');
  return normalizeWorkspace(JSON.parse(raw) as CreateWorkspace);
};

export const writeWorkspace = async (workspace: CreateWorkspace): Promise<CreateWorkspace> => {
  const next = { ...workspace, updatedAt: nowIso() };
  await mkdir(workspaceDir(next.id), { recursive: true });
  await writeFile(workspaceJsonPath(next.id), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  emitWorkspace(next);
  return next;
};

export const patchWorkspace = async (
  workspaceId: string,
  patch: WorkspacePatch,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  return writeWorkspace({ ...workspace, ...patch });
};

export const setWorkspaceSeedInput = async (
  workspaceId: string,
  patch: Pick<CreateWorkspace, 'prompt' | 'sketchDataUrl' | 'referenceDataUrls' | 'seedVariationCount' | 'aspect' | 'quality' | 'creativityMode'>,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, {
    ...patch,
    selectedSeedDesignId: null,
    seedHandover: null,
    error: null,
  })
);

export const setWorkspaceSeedRun = async (
  workspaceId: string,
  runId: string,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  return writeWorkspace({
    ...workspace,
    seedRunId: runId,
    seedRunIds: normalizeRunIds(workspace.seedRunIds, runId),
    selectedSeedDesignId: null,
    seedHandover: null,
    status: 'seed_running',
    error: null,
  });
};

export const setWorkspaceActiveSeedRun = async (
  workspaceId: string,
  runId: string,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  if (!normalizeRunIds(workspace.seedRunIds, workspace.seedRunId).includes(runId)) {
    throw new Error('Seed run was not found in this workspace.');
  }
  return writeWorkspace({
    ...workspace,
    seedRunId: runId,
    selectedSeedDesignId: null,
    seedHandover: null,
    status: 'ready',
    error: null,
  });
};

export const setWorkspaceSeedSelection = async (
  workspaceId: string,
  selectedSeedDesignId: string,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  return writeWorkspace({
    ...workspace,
    selectedSeedDesignId,
    seedHandover: workspace.seedHandover?.designId === selectedSeedDesignId ? workspace.seedHandover : null,
    status: 'ready',
    error: null,
  });
};

export const setWorkspacePages = async (
  workspaceId: string,
  pages: Array<{
    id: string;
    title: string;
    prompt: string;
    order: number;
    variationCount?: DirectDesignCount;
  }>,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  const previousById = new Map(workspace.pages.map((page) => [page.id, page]));
  return writeWorkspace({
    ...workspace,
    status: 'ready',
    error: null,
    pages: pages.map((page) => {
      const previous = previousById.get(page.id);
      return {
        id: page.id,
        title: page.title,
        prompt: page.prompt,
        order: page.order,
        variationCount: page.variationCount ?? previous?.variationCount ?? 3,
        runIds: previous?.runIds ?? [],
        runId: previous?.runId ?? null,
        selectedVariationId: previous?.selectedVariationId ?? null,
        handover: previous?.handover ?? null,
        status: previous?.status ?? 'planned',
        error: previous?.error ?? null,
      };
    }),
  });
};

export const setWorkspacePlanner = async (
  workspaceId: string,
  patch: {
    plannerVisible?: boolean;
    plannerPrompt?: string;
  },
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, {
    ...(typeof patch.plannerVisible === 'boolean' ? { plannerVisible: patch.plannerVisible } : {}),
    ...(typeof patch.plannerPrompt === 'string' ? { plannerPrompt: patch.plannerPrompt } : {}),
  })
);

export const setWorkspaceSeedHandover = async (
  workspaceId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, { seedHandover: handover })
);

export const setWorkspaceSeedHandoverForSelection = async (
  workspaceId: string,
  selectedSeedDesignId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  if (workspace.selectedSeedDesignId !== selectedSeedDesignId) {
    throw new Error('Seed selection changed before handover completed.');
  }
  return writeWorkspace({ ...workspace, seedHandover: handover });
};

export const patchWorkspacePage = async (
  workspaceId: string,
  pageId: string,
  patch: PagePatch,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  let found = false;
  const pages = workspace.pages.map((page) => {
    if (page.id !== pageId) return page;
    found = true;
    return { ...page, ...patch };
  });
  if (!found) throw new Error('Workspace page not found.');
  return writeWorkspace({ ...workspace, pages });
};

export const setWorkspacePageRun = async (
  workspaceId: string,
  pageId: string,
  runId: string,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  return patchWorkspacePage(workspaceId, pageId, {
    runId,
    runIds: normalizeRunIds(page.runIds, runId),
    selectedVariationId: null,
    handover: null,
    status: 'running',
    error: null,
  });
};

export const setWorkspaceActivePageRun = async (
  workspaceId: string,
  pageId: string,
  runId: string,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  if (!normalizeRunIds(page.runIds, page.runId).includes(runId)) {
    throw new Error('Page run was not found in this workspace.');
  }
  return patchWorkspacePage(workspaceId, pageId, {
    runId,
    selectedVariationId: null,
    handover: null,
    status: 'ready',
    error: null,
  });
};

export const setWorkspacePageHandover = async (
  workspaceId: string,
  pageId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => (
  patchWorkspacePage(workspaceId, pageId, { handover })
);

export const setWorkspacePageHandoverForSelection = async (
  workspaceId: string,
  pageId: string,
  selectedVariationId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => {
  const workspace = await readWorkspace(workspaceId);
  const page = workspace.pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error('Workspace page not found.');
  if (page.selectedVariationId !== selectedVariationId) {
    throw new Error('Page variation selection changed before handover completed.');
  }
  return writeWorkspace({
    ...workspace,
    pages: workspace.pages.map((entry) => (
      entry.id === pageId ? { ...entry, handover } : entry
    )),
  });
};

export const setWorkspaceStatus = async (
  workspaceId: string,
  status: CreateWorkspaceStatus,
  error: string | null = null,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, { status, error })
);

export const onWorkspaceChange = (
  workspaceId: string,
  listener: (workspace: CreateWorkspace) => void,
): (() => void) => {
  const set = listeners.get(workspaceId) ?? new Set<(workspace: CreateWorkspace) => void>();
  set.add(listener);
  listeners.set(workspaceId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(workspaceId);
  };
};

const emitWorkspace = (workspace: CreateWorkspace): void => {
  listeners.get(workspace.id)?.forEach((listener) => listener(workspace));
};
