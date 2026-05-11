import type {
  CodexBridgeStatus,
  CodexBridgeStatusResponse,
  AppStatus,
  AppStatusResponse,
  CreateWorkspace,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  CreateWorkspaceRunResponse,
  CreateWorkspaceSeedRunRequest,
  CreateRunRequest,
  CreateRunResponse,
  ConnectionResponse,
  DesignRun,
  HandoverResponse,
  LocalUiConnection,
  PlanWorkspacePagesRequest,
  TwelveUiConnectStartResponse,
  UpdateWorkspacePlannerRequest,
  UpdateWorkspacePageRequest,
  UpdateWorkspacePageRunRequest,
  UpdateWorkspaceSeedSelectionRequest,
  UpdateWorkspaceSeedRunRequest,
  WorkspaceHandoverResponse,
  CodexBridgeEvent,
  DesignImageEditRequest,
  DesignImageExtensionRequest,
  DesignImageRevisionResponse,
  UpdateDesignActiveRevisionRequest,
  UpdateDesignActiveRevisionResponse,
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

export const createSeedRun = async (
  workspaceId: string,
  request: CreateWorkspaceSeedRunRequest,
): Promise<CreateWorkspaceRunResponse> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/seed-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<CreateWorkspaceRunResponse>(response);
};

export const updateActiveSeedRun = async (
  workspaceId: string,
  request: UpdateWorkspaceSeedRunRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/seed-run`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
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

export const updateWorkspacePlanner = async (
  workspaceId: string,
  request: UpdateWorkspacePlannerRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/planner`, {
    method: 'PATCH',
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

export const updateActivePageRun = async (
  workspaceId: string,
  pageId: string,
  request: UpdateWorkspacePageRunRequest,
): Promise<CreateWorkspace> => {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}/run`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  return (await parseJsonResponse<CreateWorkspaceResponse>(response)).workspace;
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

export const startTwelveUiConnect = async (): Promise<TwelveUiConnectStartResponse> => {
  const response = await fetch('/api/auth/12ui/connect/start', {
    method: 'POST',
  });
  return parseJsonResponse<TwelveUiConnectStartResponse>(response);
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

export const createDesignImageEdit = async (
  runId: string,
  designId: string,
  request: DesignImageEditRequest,
): Promise<DesignImageRevisionResponse> => {
  const response = await fetch(
    `/api/runs/${encodeURIComponent(runId)}/designs/${encodeURIComponent(designId)}/edits`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  return parseJsonResponse<DesignImageRevisionResponse>(response);
};

export const createDesignImageExtension = async (
  runId: string,
  designId: string,
  request: DesignImageExtensionRequest,
): Promise<DesignImageRevisionResponse> => {
  const response = await fetch(
    `/api/runs/${encodeURIComponent(runId)}/designs/${encodeURIComponent(designId)}/extensions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  return parseJsonResponse<DesignImageRevisionResponse>(response);
};

export const updateDesignActiveRevision = async (
  runId: string,
  designId: string,
  request: UpdateDesignActiveRevisionRequest,
): Promise<UpdateDesignActiveRevisionResponse> => {
  const response = await fetch(
    `/api/runs/${encodeURIComponent(runId)}/designs/${encodeURIComponent(designId)}/active-revision`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  return parseJsonResponse<UpdateDesignActiveRevisionResponse>(response);
};

export const runAssetUrl = (runId: string, assetPath: string): string => (
  `/api/runs/${encodeURIComponent(runId)}/assets/${assetPath.split('/').map(encodeURIComponent).join('/')}`
);
