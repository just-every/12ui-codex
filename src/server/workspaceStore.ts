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
    seedVariationCount: request.seedVariationCount ?? 3,
    seedRunId: null,
    selectedSeedDesignId: null,
    seedHandover: null,
    pages: [],
    error: null,
    createdAt,
    updatedAt: createdAt,
  };
  await mkdir(workspaceDir(id), { recursive: true });
  return writeWorkspace(workspace);
};

export const readWorkspace = async (workspaceId: string): Promise<CreateWorkspace> => {
  const raw = await readFile(workspaceJsonPath(workspaceId), 'utf8');
  return JSON.parse(raw) as CreateWorkspace;
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

export const setWorkspaceSeedRun = async (
  workspaceId: string,
  runId: string,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, {
    seedRunId: runId,
    selectedSeedDesignId: null,
    status: 'seed_running',
    error: null,
  })
);

export const setWorkspaceSeedSelection = async (
  workspaceId: string,
  selectedSeedDesignId: string,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, {
    selectedSeedDesignId,
    status: 'ready',
    error: null,
  })
);

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
        runId: previous?.runId ?? null,
        selectedVariationId: previous?.selectedVariationId ?? null,
        handover: previous?.handover ?? null,
        status: previous?.status ?? 'planned',
        error: previous?.error ?? null,
      };
    }),
  });
};

export const setWorkspaceSeedHandover = async (
  workspaceId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => (
  patchWorkspace(workspaceId, { seedHandover: handover })
);

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
): Promise<CreateWorkspace> => (
  patchWorkspacePage(workspaceId, pageId, {
    runId,
    selectedVariationId: null,
    handover: null,
    status: 'running',
    error: null,
  })
);

export const setWorkspacePageHandover = async (
  workspaceId: string,
  pageId: string,
  handover: HandoverResult,
): Promise<CreateWorkspace> => (
  patchWorkspacePage(workspaceId, pageId, { handover })
);

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
