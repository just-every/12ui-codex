import type {
  CodexBridgeStatus,
  CodexBridgeStatusResponse,
  AppStatus,
  AppStatusResponse,
  CreateWorkspace,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  CreateWorkspaceRunResponse,
  CreateRunRequest,
  CreateRunResponse,
  ConnectionResponse,
  DesignRun,
  HandoverResponse,
  LocalUiConnection,
  PlanWorkspacePagesRequest,
  UpdateWorkspacePageRequest,
  UpdateWorkspaceSeedSelectionRequest,
  WorkspaceHandoverResponse,
  CodexBridgeEvent,
} from '../shared/types.js';

const parseJsonResponse = async <T,>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data
      ? String((data as { error: unknown }).error)
      : `Request failed with ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
};

export const createRun = async (request: CreateRunRequest): Promise<DesignRun> => {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<CreateRunResponse>(response)).run;
};

export const getAppStatus = async (): Promise<AppStatus> => {
  const response = await fetch('/api/status');
  return (await parseJsonResponse<AppStatusResponse>(response)).status;
};

export const getRun = async (runId: string): Promise<DesignRun> => {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
  return (await parseJsonResponse<CreateRunResponse>(response)).run;
};

export const createWorkspace = async (request: CreateWorkspaceRequest): Promise<CreateWorkspace> => {
  const response = await fetch('/api/workspaces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
};

export const getWorkspace = async (workspaceId: string): Promise<CreateWorkspace> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`);
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
};

export const createSeedRun = async (workspaceId: string): Promise<CreateWorkspaceRunResponse> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/seed-runs`, {
    method: 'POST',
  });
  return parseJsonResponse<CreateWorkspaceRunResponse>(response);
};

export const updateSeedSelection = async (
  workspaceId: string,
  request: UpdateWorkspaceSeedSelectionRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/seed-selection`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
};

export const planWorkspacePages = async (
  workspaceId: string,
  request: PlanWorkspacePagesRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/page-plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
};

export const updateWorkspacePage = async (
  workspaceId: string,
  pageId: string,
  request: UpdateWorkspacePageRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
};

export const createPageRun = async (
  workspaceId: string,
  pageId: string,
): Promise<CreateWorkspaceRunResponse> => {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}/runs`,
    { method: 'POST' },
  );
  return parseJsonResponse<CreateWorkspaceRunResponse>(response);
};

export const createPageHandover = async (
  workspaceId: string,
  pageId: string,
): Promise<WorkspaceHandoverResponse> => {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}/handover`,
    { method: 'POST' },
  );
  return parseJsonResponse<WorkspaceHandoverResponse>(response);
};

export const createSeedHandover = async (
  workspaceId: string,
): Promise<WorkspaceHandoverResponse> => {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/seed-handover`,
    { method: 'POST' },
  );
  return parseJsonResponse<WorkspaceHandoverResponse>(response);
};

export const sendTextHandoff = async (
  workspaceId: string,
  request: { handoffText: string; selectedImages: unknown[] },
): Promise<CodexBridgeEvent> => {
  const response = await fetch(`/api/codex/workspaces/${encodeURIComponent(workspaceId)}/handoff-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<{ event: CodexBridgeEvent }>(response)).event;
};

export const getConnection = async (): Promise<LocalUiConnection> => {
  const response = await fetch('/api/connection');
  return (await parseJsonResponse<ConnectionResponse>(response)).connection;
};

export const updateConnection = async (origin: string): Promise<LocalUiConnection> => {
  const response = await fetch('/api/connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ origin }),
  });
  return (await parseJsonResponse<ConnectionResponse>(response)).connection;
};

export const getCodexBridgeStatus = async (workspaceId: string): Promise<CodexBridgeStatus> => {
  const response = await fetch(`/api/codex/workspaces/${encodeURIComponent(workspaceId)}/status`);
  return (await parseJsonResponse<CodexBridgeStatusResponse>(response)).status;
};

export const createHandover = async (runId: string, designId: string): Promise<DesignRun> => {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/handover`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ designId }),
  });
  return (await parseJsonResponse<HandoverResponse>(response)).run;
};

export const runAssetUrl = (runId: string, assetPath: string): string => (
  `/api/runs/${encodeURIComponent(runId)}/assets/${assetPath.split('/').map(encodeURIComponent).join('/')}`
);
