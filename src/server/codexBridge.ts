import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CodexBridgeEvent,
  CodexBridgeEventType,
  CodexBridgeStatus,
  CodexBridgeWaitResponse,
} from '../shared/types.js';
import { workspaceDir } from './workspaceStore.js';

type EventListener = (event: CodexBridgeEvent) => void;
type StatusListener = (status: CodexBridgeStatus) => void;

const eventListeners = new Map<string, Set<EventListener>>();
const statusListeners = new Map<string, Set<StatusListener>>();
const latestEvents = new Map<string, CodexBridgeEvent>();
const waitingClientCounts = new Map<string, number>();
const eventIds = new Map<string, number>();

const nowIso = (): string => new Date().toISOString();
const eventLogPath = (workspaceId: string): string => path.join(workspaceDir(workspaceId), 'codex-events.jsonl');
const REPLAY_WINDOW_MS = 120_000;

const nextEventId = async (workspaceId: string): Promise<number> => {
  let current = eventIds.get(workspaceId) ?? latestEvents.get(workspaceId)?.id ?? null;
  if (current === null) {
    const events = await readCodexBridgeEvents(workspaceId);
    current = events.reduce((max, event) => Math.max(max, event.id), 0);
  }
  const next = current + 1;
  eventIds.set(workspaceId, next);
  return next;
};

export const getCodexBridgeStatus = (workspaceId: string): CodexBridgeStatus => ({
  workspaceId,
  isWaiting: (waitingClientCounts.get(workspaceId) ?? 0) > 0,
  waitingClientCount: waitingClientCounts.get(workspaceId) ?? 0,
  lastEvent: latestEvents.get(workspaceId) ?? null,
  updatedAt: nowIso(),
});

const emitStatus = (workspaceId: string): void => {
  const status = getCodexBridgeStatus(workspaceId);
  statusListeners.get(workspaceId)?.forEach((listener) => listener(status));
};

const addWaitingClient = (workspaceId: string): (() => void) => {
  waitingClientCounts.set(workspaceId, (waitingClientCounts.get(workspaceId) ?? 0) + 1);
  emitStatus(workspaceId);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const next = Math.max(0, (waitingClientCounts.get(workspaceId) ?? 0) - 1);
    if (next === 0) {
      waitingClientCounts.delete(workspaceId);
    } else {
      waitingClientCounts.set(workspaceId, next);
    }
    emitStatus(workspaceId);
  };
};

export const onCodexBridgeEvent = (
  workspaceId: string,
  listener: EventListener,
): (() => void) => {
  const set = eventListeners.get(workspaceId) ?? new Set<EventListener>();
  set.add(listener);
  eventListeners.set(workspaceId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) eventListeners.delete(workspaceId);
  };
};

export const onCodexBridgeStatus = (
  workspaceId: string,
  listener: StatusListener,
): (() => void) => {
  const set = statusListeners.get(workspaceId) ?? new Set<StatusListener>();
  set.add(listener);
  statusListeners.set(workspaceId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) statusListeners.delete(workspaceId);
  };
};

export const emitCodexBridgeEvent = async (args: {
  workspaceId: string;
  type: CodexBridgeEventType;
  message: string;
  payload?: Record<string, unknown>;
}): Promise<CodexBridgeEvent> => {
  const event: CodexBridgeEvent = {
    id: await nextEventId(args.workspaceId),
    at: nowIso(),
    workspaceId: args.workspaceId,
    type: args.type,
    message: args.message,
    payload: args.payload ?? {},
  };
  latestEvents.set(args.workspaceId, event);
  await mkdir(workspaceDir(args.workspaceId), { recursive: true });
  await appendFile(eventLogPath(args.workspaceId), `${JSON.stringify(event)}\n`, 'utf8');
  eventListeners.get(args.workspaceId)?.forEach((listener) => listener(event));
  emitStatus(args.workspaceId);
  return event;
};

export const readCodexBridgeEvents = async (workspaceId: string): Promise<CodexBridgeEvent[]> => {
  try {
    const raw = await readFile(eventLogPath(workspaceId), 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as CodexBridgeEvent);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
};

const findLatestAcceptedEvent = async (
  workspaceId: string,
  acceptedTypes: Set<CodexBridgeEventType>,
  afterEventId: number,
): Promise<CodexBridgeEvent | null> => {
  const latest = latestEvents.get(workspaceId);
  if (latest && latest.id > afterEventId && (acceptedTypes.size === 0 || acceptedTypes.has(latest.type))) return latest;
  const events = await readCodexBridgeEvents(workspaceId);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.id <= afterEventId) continue;
    if (acceptedTypes.size === 0 || acceptedTypes.has(event.type)) return event;
  }
  return null;
};

const isFreshReplayEvent = (event: CodexBridgeEvent, afterEventId: number): boolean => {
  if (afterEventId > 0) return true;
  const timestamp = Date.parse(event.at);
  return Number.isFinite(timestamp) && Date.now() - timestamp <= REPLAY_WINDOW_MS;
};

const shouldReplayExistingEvent = (acceptedTypes: Set<CodexBridgeEventType>, afterEventId: number): boolean => {
  if (afterEventId > 0) return true;
  if (acceptedTypes.size === 0) return false;
  const terminalHandoverTypes = new Set<CodexBridgeEventType>(['handover_completed', 'handover_failed']);
  return [...acceptedTypes].every((type) => terminalHandoverTypes.has(type));
};

const writeSse = (
  response: ServerResponse,
  event: string,
  data: unknown,
): void => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const streamCodexBridgeStatus = (
  workspaceId: string,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  const write = (status: CodexBridgeStatus): void => writeSse(response, 'codex_bridge_status', status);
  write(getCodexBridgeStatus(workspaceId));
  const unsubscribe = onCodexBridgeStatus(workspaceId, write);
  request.on('close', unsubscribe);
};

export const streamCodexBridgeEvents = (
  workspaceId: string,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  const doneWaiting = addWaitingClient(workspaceId);
  writeSse(response, 'codex_bridge_status', getCodexBridgeStatus(workspaceId));
  const write = (event: CodexBridgeEvent): void => writeSse(response, 'codex_bridge_event', event);
  const unsubscribe = onCodexBridgeEvent(workspaceId, write);
  request.on('close', () => {
    unsubscribe();
    doneWaiting();
  });
};

export const waitForCodexBridgeEvent = async (
  workspaceId: string,
  types: CodexBridgeEventType[],
  timeoutMs: number,
  request: IncomingMessage,
  afterEventId = 0,
): Promise<CodexBridgeWaitResponse> => {
  const acceptedTypes = new Set(types);
  if (shouldReplayExistingEvent(acceptedTypes, afterEventId)) {
    const existingEvent = await findLatestAcceptedEvent(workspaceId, acceptedTypes, afterEventId);
    if (existingEvent && isFreshReplayEvent(existingEvent, afterEventId)) {
      return {
        status: 'event',
        event: existingEvent,
        bridgeStatus: getCodexBridgeStatus(workspaceId),
      };
    }
  }
  const doneWaiting = addWaitingClient(workspaceId);
  return new Promise<CodexBridgeWaitResponse>((resolve) => {
    let finished = false;
    const finish = (status: CodexBridgeWaitResponse['status'], event: CodexBridgeEvent | null): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      unsubscribe();
      doneWaiting();
      resolve({
        status,
        event,
        bridgeStatus: getCodexBridgeStatus(workspaceId),
      });
    };
    const unsubscribe = onCodexBridgeEvent(workspaceId, (event) => {
      if (event.id > afterEventId && (acceptedTypes.size === 0 || acceptedTypes.has(event.type))) {
        finish('event', event);
      }
    });
    const timeout = setTimeout(() => finish('timeout', null), timeoutMs);
    request.on('close', () => finish('closed', null));
  });
};
