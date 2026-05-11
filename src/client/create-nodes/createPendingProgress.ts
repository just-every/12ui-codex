import type { DesignRun } from '../../shared/types.js';

export const CREATE_PLANNER_ESTIMATE_MS = 30_000;
export const CREATE_PROMPT_ESTIMATE_MS = 30_000;
export const CREATE_RENDER_ESTIMATE_MS = 90_000;
export const CREATE_DESIGN_ESTIMATE_MS = CREATE_PLANNER_ESTIMATE_MS + CREATE_PROMPT_ESTIMATE_MS + CREATE_RENDER_ESTIMATE_MS;
const CREATE_RENDER_TAIL_START_RATIO = 0.7;
const CREATE_RENDER_TAIL_HALF_LIFE_MS = 10_000;

export type CreatePendingProgressSnapshot = {
  progress: number;
  secondsRemaining: number;
  etaLabel: string;
  stageLabel: string;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const parseDateMs = (value: string | null | undefined): number | null => {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatEtaLabel = (secondsRemaining: number): string => {
  if (secondsRemaining <= 0) return 'almost ready';
  if (secondsRemaining >= 60) {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`} remaining`;
  }
  return `${secondsRemaining}s remaining`;
};

const resolveRunStartedAtMs = (run: DesignRun, nowMs: number): number => (
  parseDateMs(run.createdAt)
  ?? parseDateMs(run.events[0]?.at)
  ?? nowMs
);

const eventTimeMs = (
  run: DesignRun,
  type: DesignRun['events'][number]['type'],
): number | null => {
  const event = run.events.find((entry) => entry.type === type);
  return parseDateMs(event?.at);
};

const promptPlanningStartedAtMs = (run: DesignRun): number | null => {
  const prompting = eventTimeMs(run, 'prompting');
  if (prompting !== null) return prompting;
  const planningEvents = run.events.filter((entry) => entry.type === 'planning');
  return parseDateMs(planningEvents[1]?.at);
};

const latestProgressEventType = (run: DesignRun): DesignRun['events'][number]['type'] | null => {
  const event = [...run.events].reverse().find((entry) => (
    entry.type === 'generating'
    || entry.type === 'generated'
    || entry.type === 'planned'
    || entry.type === 'prompting'
    || entry.type === 'planning'
    || entry.type === 'queued'
  ));
  return event?.type ?? null;
};

const renderPhaseProgress = (elapsedMs: number): number => {
  const linearProgress = elapsedMs / CREATE_RENDER_ESTIMATE_MS;
  if (linearProgress <= CREATE_RENDER_TAIL_START_RATIO) {
    return clamp(linearProgress, 0, CREATE_RENDER_TAIL_START_RATIO);
  }

  const tailSpan = 1 - CREATE_RENDER_TAIL_START_RATIO;
  const tailStartMs = CREATE_RENDER_ESTIMATE_MS * CREATE_RENDER_TAIL_START_RATIO;
  const tailElapsedMs = Math.max(0, elapsedMs - tailStartMs);
  const tailProgress = tailSpan * (1 - Math.pow(0.5, tailElapsedMs / CREATE_RENDER_TAIL_HALF_LIFE_MS));
  return clamp(CREATE_RENDER_TAIL_START_RATIO + tailProgress, CREATE_RENDER_TAIL_START_RATIO, 1);
};

export const buildCreatePendingProgressSnapshot = (args: {
  run: DesignRun;
  nowMs: number;
}): CreatePendingProgressSnapshot => {
  const startedAtMs = resolveRunStartedAtMs(args.run, args.nowMs);
  const latestType = latestProgressEventType(args.run);
  const promptStartedAtMs = promptPlanningStartedAtMs(args.run);
  const renderingAtMs = eventTimeMs(args.run, 'generating');
  const generatedAtMs = eventTimeMs(args.run, 'generated');

  if (args.run.status === 'queued' || latestType === 'queued') {
    return {
      progress: 0.04,
      secondsRemaining: Math.ceil(CREATE_DESIGN_ESTIMATE_MS / 1000),
      etaLabel: formatEtaLabel(Math.ceil(CREATE_DESIGN_ESTIMATE_MS / 1000)),
      stageLabel: 'Queued',
    };
  }

  if (renderingAtMs) {
    const elapsedMs = Math.max(0, args.nowMs - renderingAtMs);
    const phaseProgress = renderPhaseProgress(elapsedMs);
    const secondsRemaining = Math.max(0, Math.ceil((CREATE_RENDER_ESTIMATE_MS - elapsedMs) / 1000));
    return {
      progress: clamp(0.4 + (phaseProgress * 0.6), 0.4, 0.98),
      secondsRemaining,
      etaLabel: formatEtaLabel(secondsRemaining),
      stageLabel: 'Rendering image',
    };
  }

  if (generatedAtMs) {
    return {
      progress: 0.98,
      secondsRemaining: 0,
      etaLabel: 'almost ready',
      stageLabel: 'Finalizing preview',
    };
  }

  if (promptStartedAtMs) {
    const elapsedMs = Math.max(0, args.nowMs - promptStartedAtMs);
    const phaseProgress = clamp(elapsedMs / CREATE_PROMPT_ESTIMATE_MS, 0, 1);
    const secondsRemaining = Math.max(
      0,
      Math.ceil(((CREATE_PROMPT_ESTIMATE_MS - Math.min(elapsedMs, CREATE_PROMPT_ESTIMATE_MS)) + CREATE_RENDER_ESTIMATE_MS) / 1000),
    );
    return {
      progress: clamp(0.2 + (phaseProgress * 0.2), 0.2, 0.4),
      secondsRemaining,
      etaLabel: formatEtaLabel(secondsRemaining),
      stageLabel: 'Planning design',
    };
  }

  const elapsedMs = Math.max(0, args.nowMs - (eventTimeMs(args.run, 'planning') ?? startedAtMs));
  const phaseProgress = clamp(elapsedMs / CREATE_PLANNER_ESTIMATE_MS, 0, 1);
  const secondsRemaining = Math.max(
    0,
    Math.ceil(((CREATE_PLANNER_ESTIMATE_MS - Math.min(elapsedMs, CREATE_PLANNER_ESTIMATE_MS)) + CREATE_PROMPT_ESTIMATE_MS + CREATE_RENDER_ESTIMATE_MS) / 1000),
  );

  return {
    progress: clamp(phaseProgress * 0.2, 0.04, 0.2),
    secondsRemaining,
    etaLabel: formatEtaLabel(secondsRemaining),
    stageLabel: 'Planning concept',
  };
};
