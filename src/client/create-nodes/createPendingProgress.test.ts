import { describe, expect, it } from 'vitest';
import type { DesignRun, RunEvent } from '../../shared/types.js';
import { buildCreatePendingProgressSnapshot } from './createPendingProgress.js';

const event = (args: {
  at: string;
  id: number;
  type: RunEvent['type'];
  progress?: number;
}): RunEvent => ({
  id: args.id,
  at: args.at,
  type: args.type,
  message: args.type,
  progress: args.progress ?? 0,
});

const run = (createdAt: string, events: RunEvent[] = []): DesignRun => ({
  id: 'run-1',
  status: 'running',
  prompt: 'Progress test',
  batchSize: 3,
  aspect: 'portrait',
  quality: 'medium',
  textModel: 'codex-gpt-5.5-high',
  imageModel: 'codex-gpt-image-2',
  progress: 0,
  error: null,
  events,
  plannedDesigns: [],
  designs: [],
  handovers: [],
  createdAt,
  updatedAt: createdAt,
});

describe('create pending progress', () => {
  it('uses the first 20 percent for the planner estimate', () => {
    const createdAt = '2026-05-11T04:00:00.000Z';
    const snapshot = buildCreatePendingProgressSnapshot({
      run: run(createdAt, [
        event({ id: 1, at: createdAt, type: 'planning' }),
      ]),
      nowMs: Date.parse('2026-05-11T04:00:05.000Z'),
    });

    expect(snapshot.progress).toBe(0.1);
    expect(snapshot.secondsRemaining).toBe(55);
    expect(snapshot.etaLabel).toBe('55s remaining');
    expect(snapshot.stageLabel).toBe('Planning concept');
  });

  it('uses the second 20 percent for individual prompt planning', () => {
    const createdAt = '2026-05-11T04:00:00.000Z';
    const plannedAt = '2026-05-11T04:00:10.000Z';
    const snapshot = buildCreatePendingProgressSnapshot({
      run: run(createdAt, [
        event({ id: 1, at: createdAt, type: 'planning' }),
        event({ id: 2, at: plannedAt, type: 'planned' }),
      ]),
      nowMs: Date.parse('2026-05-11T04:00:15.000Z'),
    });

    expect(snapshot.progress).toBeCloseTo(0.3);
    expect(snapshot.secondsRemaining).toBe(45);
    expect(snapshot.etaLabel).toBe('45s remaining');
    expect(snapshot.stageLabel).toBe('Planning design');
  });

  it('uses the final 60 percent for image rendering', () => {
    const createdAt = '2026-05-11T04:00:00.000Z';
    const plannedAt = '2026-05-11T04:00:10.000Z';
    const renderingAt = '2026-05-11T04:00:20.000Z';
    const snapshot = buildCreatePendingProgressSnapshot({
      run: run(createdAt, [
        event({ id: 1, at: createdAt, type: 'planning' }),
        event({ id: 2, at: plannedAt, type: 'planned' }),
        event({ id: 3, at: renderingAt, type: 'generating' }),
      ]),
      nowMs: Date.parse('2026-05-11T04:00:30.000Z'),
    });

    expect(snapshot.progress).toBe(0.55);
    expect(snapshot.secondsRemaining).toBe(30);
    expect(snapshot.etaLabel).toBe('30s remaining');
    expect(snapshot.stageLabel).toBe('Rendering image');
  });

  it('keeps the bar visible at the start and shy of complete after rendering estimate', () => {
    const createdAt = '2026-05-11T04:00:00.000Z';
    const renderingAt = '2026-05-11T04:00:20.000Z';
    expect(buildCreatePendingProgressSnapshot({
      run: run(createdAt),
      nowMs: Date.parse(createdAt),
    }).progress).toBe(0.04);

    const overdue = buildCreatePendingProgressSnapshot({
      run: run(createdAt, [
        event({ id: 1, at: createdAt, type: 'planning' }),
        event({ id: 2, at: '2026-05-11T04:00:10.000Z', type: 'planned' }),
        event({ id: 3, at: renderingAt, type: 'generating' }),
      ]),
      nowMs: Date.parse('2026-05-11T04:01:30.000Z'),
    });

    expect(overdue.progress).toBe(0.98);
    expect(overdue.etaLabel).toBe('almost ready');
  });
});
