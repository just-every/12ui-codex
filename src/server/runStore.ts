import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DesignOutput,
  DesignRun,
  HandoverResult,
  RunEvent,
  RunStatus,
} from '../shared/types.js';
import { runsRoot, serverConfig } from './config.js';
import { normalizeCreativityMode } from './validation.js';

type RunPatch = Partial<Omit<DesignRun, 'id' | 'events' | 'createdAt'>>;

const listeners = new Map<string, Set<(run: DesignRun) => void>>();
const runLocks = new Map<string, Promise<unknown>>();

const nowIso = (): string => new Date().toISOString();

const withRunLock = async <T,>(runId: string, operation: () => Promise<T>): Promise<T> => {
  const previous = runLocks.get(runId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  runLocks.set(runId, next.catch(() => undefined));
  return next;
};

export const runDir = (runId: string): string => path.join(runsRoot, runId);
export const runJsonPath = (runId: string): string => path.join(runDir(runId), 'run.json');

export const ensureRunsRoot = async (): Promise<void> => {
  await mkdir(runsRoot, { recursive: true });
};

export const createRunRecord = async (args: {
  prompt: string;
  batchSize: number;
  aspect: DesignRun['aspect'];
  quality: DesignRun['quality'];
  creativityMode: DesignRun['creativityMode'];
}): Promise<DesignRun> => {
  await ensureRunsRoot();
  const id = randomUUID();
  const createdAt = nowIso();
  const run: DesignRun = {
    id,
    status: 'queued',
    prompt: args.prompt,
    batchSize: args.batchSize,
    aspect: args.aspect,
    quality: args.quality,
    creativityMode: args.creativityMode,
    textModel: serverConfig.textModel,
    imageModel: serverConfig.imageModel,
    progress: 0,
    error: null,
    events: [],
    plannedDesigns: [],
    designs: [],
    handovers: [],
    createdAt,
    updatedAt: createdAt,
  };
  await mkdir(runDir(id), { recursive: true });
  return writeRun(run);
};

export const readRun = async (runId: string): Promise<DesignRun> => {
  const raw = await readFile(runJsonPath(runId), 'utf8');
  const run = JSON.parse(raw) as DesignRun;
  const normalizedRun: DesignRun = {
    ...run,
    creativityMode: normalizeCreativityMode(run.creativityMode),
  };
  if (Array.isArray(normalizedRun.plannedDesigns)) return normalizedRun;
  try {
    const rawDesignPrompts = await readFile(path.join(runDir(runId), 'design-prompts.json'), 'utf8');
    const designPrompts = JSON.parse(rawDesignPrompts) as Array<{ branchIndex?: unknown; title?: unknown; prompt?: unknown }>;
    return {
      ...run,
      creativityMode: normalizedRun.creativityMode,
      plannedDesigns: Array.isArray(designPrompts)
        ? designPrompts.map((designPrompt, index) => ({
          branchIndex: typeof designPrompt.branchIndex === 'number' ? designPrompt.branchIndex : index + 1,
          title: typeof designPrompt.title === 'string' ? designPrompt.title : `Design ${index + 1}`,
          prompt: typeof designPrompt.prompt === 'string' ? designPrompt.prompt : '',
        }))
        : [],
    };
  } catch {
    try {
      const rawBranchPrompts = await readFile(path.join(runDir(runId), 'branch-prompts.json'), 'utf8');
      const branchPrompts = JSON.parse(rawBranchPrompts) as Array<{ title?: unknown; prompt?: unknown }>;
      return {
        ...run,
        creativityMode: normalizedRun.creativityMode,
        plannedDesigns: Array.isArray(branchPrompts)
          ? branchPrompts.map((branch, index) => ({
            branchIndex: index + 1,
            title: typeof branch.title === 'string' ? branch.title : `Design ${index + 1}`,
            prompt: typeof branch.prompt === 'string' ? branch.prompt : '',
          }))
          : [],
      };
    } catch {
      return { ...normalizedRun, plannedDesigns: [] };
    }
  }
};

export const writeRun = async (run: DesignRun): Promise<DesignRun> => {
  const next = { ...run, updatedAt: nowIso() };
  await mkdir(runDir(next.id), { recursive: true });
  await writeFile(runJsonPath(next.id), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  emitRun(next);
  return next;
};

export const patchRun = async (runId: string, patch: RunPatch): Promise<DesignRun> => {
  return withRunLock(runId, async () => {
    const run = await readRun(runId);
    return writeRun({ ...run, plannedDesigns: run.plannedDesigns ?? [], ...patch });
  });
};

export const addRunEvent = async (
  runId: string,
  event: Omit<RunEvent, 'id' | 'at'>,
  patch: RunPatch = {},
): Promise<DesignRun> => {
  return withRunLock(runId, async () => {
    const run = await readRun(runId);
    const nextEvent: RunEvent = {
      id: (run.events.at(-1)?.id ?? 0) + 1,
      at: nowIso(),
      ...event,
    };
    const status = patch.status ?? run.status;
    return writeRun({
      ...run,
      plannedDesigns: run.plannedDesigns ?? [],
      ...patch,
      status,
      progress: patch.progress ?? event.progress,
      events: [...run.events, nextEvent],
    });
  });
};

export const addDesign = async (runId: string, design: DesignOutput): Promise<DesignRun> => {
  return withRunLock(runId, async () => {
    const run = await readRun(runId);
    return writeRun({ ...run, plannedDesigns: run.plannedDesigns ?? [], designs: [...run.designs, design] });
  });
};

export const updateDesign = async (
  runId: string,
  designId: string,
  update: (design: DesignOutput, run: DesignRun) => DesignOutput,
): Promise<DesignRun> => {
  return withRunLock(runId, async () => {
    const run = await readRun(runId);
    const designIndex = run.designs.findIndex((design) => design.id === designId);
    if (designIndex < 0) {
      throw new Error('Design not found.');
    }
    const nextDesigns = run.designs.slice();
    nextDesigns[designIndex] = update(run.designs[designIndex]!, run);
    return writeRun({ ...run, plannedDesigns: run.plannedDesigns ?? [], designs: nextDesigns });
  });
};

export const addHandover = async (runId: string, handover: HandoverResult): Promise<DesignRun> => {
  return withRunLock(runId, async () => {
    const run = await readRun(runId);
    return writeRun({ ...run, plannedDesigns: run.plannedDesigns ?? [], handovers: [...run.handovers, handover] });
  });
};

export const setRunStatus = async (
  runId: string,
  status: RunStatus,
  progress: number,
  error: string | null = null,
): Promise<DesignRun> => (
  patchRun(runId, { status, progress, error })
);

export const onRunChange = (runId: string, listener: (run: DesignRun) => void): (() => void) => {
  const set = listeners.get(runId) ?? new Set<(run: DesignRun) => void>();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(runId);
  };
};

const emitRun = (run: DesignRun): void => {
  listeners.get(run.id)?.forEach((listener) => listener(run));
};
