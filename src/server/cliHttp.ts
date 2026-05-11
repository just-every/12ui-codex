import type { CodexBridgeEventType, CreateWorkspaceResponse, CreateWorkspaceRunResponse } from '../shared/types.js';
import { userVisibleBrowserAction } from './browserOpenInstructions.js';
import { originForPort, resolveCliPort } from './serverPort.js';

export const localOrigin = (): string => originForPort(resolveCliPort());

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const body = text.trim() ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : `Request failed with ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
};

export const getStatus = async (origin = localOrigin()): Promise<unknown> => {
  const response = await fetch(new URL('/api/status', origin));
  return parseJson<unknown>(response);
};

export const createWorkspaceAndSeedRun = async (
  input: Record<string, unknown>,
  origin = localOrigin(),
): Promise<{
  workspaceId: string;
  workspaceUrl: string;
  browserUrl: string;
  seedRunId: string;
  userMessage: string;
  workspace: CreateWorkspaceResponse['workspace'];
}> => {
  const createResponse = await fetch(new URL('/api/workspaces', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      seedVariationCount: input.seedVariationCount ?? 3,
      referenceDataUrls: input.referenceDataUrls ?? [],
    }),
  });
  const { workspace } = await parseJson<CreateWorkspaceResponse>(createResponse);
  const seedResponse = await fetch(new URL(`/api/workspaces/${encodeURIComponent(workspace.id)}/seed-runs`, origin), {
    method: 'POST',
  });
  const seeded = await parseJson<CreateWorkspaceRunResponse>(seedResponse);
  const workspaceUrl = new URL(`/workspaces/${encodeURIComponent(workspace.id)}`, origin).toString();
  return {
    workspaceId: workspace.id,
    workspaceUrl,
    browserUrl: workspaceUrl,
    seedRunId: seeded.run.id,
    userMessage: userVisibleBrowserAction(workspaceUrl, 'review the generated designs and pick one'),
    workspace: seeded.workspace,
  };
};

export const waitForWorkspaceEvent = async (args: {
  workspaceId: string;
  events: CodexBridgeEventType[];
  timeoutMs: number;
  origin?: string;
}): Promise<unknown> => {
  const origin = args.origin ?? localOrigin();
  const url = new URL(`/api/codex/workspaces/${encodeURIComponent(args.workspaceId)}/wait`, origin);
  url.searchParams.set('events', args.events.join(','));
  url.searchParams.set('timeoutMs', String(args.timeoutMs));
  const response = await fetch(url);
  return parseJson<unknown>(response);
};

export const getWorkspaceContext = async (workspaceId: string, origin = localOrigin()): Promise<unknown> => {
  const response = await fetch(new URL(`/api/codex/workspaces/${encodeURIComponent(workspaceId)}/context`, origin));
  return parseJson<unknown>(response);
};

export const getWorkspaceEventLog = async (workspaceId: string, origin = localOrigin()): Promise<unknown> => {
  const response = await fetch(new URL(`/api/codex/workspaces/${encodeURIComponent(workspaceId)}/event-log`, origin));
  return parseJson<unknown>(response);
};
