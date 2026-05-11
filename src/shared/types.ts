export type RunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type DesignAspect = 'portrait' | 'landscape';
export type DesignQuality = 'low' | 'medium' | 'high';

export type CreateRunRequest = {
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  batchSize: number;
  aspect: DesignAspect;
  quality: DesignQuality;
};

export type DirectDesignCount = 1 | 3 | 6 | 12;

export type DirectCreateHandoverRequest = {
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  designCount: DirectDesignCount;
  aspect: DesignAspect;
  quality: DesignQuality;
};

export type DesignOutput = {
  id: string;
  branchIndex: number;
  title: string;
  prompt: string;
  assetPath: string;
  model: string;
  createdAt: string;
};

export type PlannedDesign = {
  branchIndex: number;
  title: string;
  prompt: string;
};

export type RunEvent = {
  id: number;
  at: string;
  type: 'queued' | 'planning' | 'planned' | 'generating' | 'generated' | 'handover' | 'completed' | 'failed';
  message: string;
  progress: number;
};

export type HandoverResult = {
  designId: string;
  runId: string;
  statusUrl?: string;
  handoverUrl?: string;
  handoverHtmlUrl?: string;
  zipUrl?: string;
  raw: unknown;
  createdAt: string;
};

export type DesignRun = {
  id: string;
  status: RunStatus;
  prompt: string;
  batchSize: number;
  aspect: DesignAspect;
  quality: DesignQuality;
  textModel: string;
  imageModel: string;
  progress: number;
  error: string | null;
  events: RunEvent[];
  plannedDesigns: PlannedDesign[];
  designs: DesignOutput[];
  handovers: HandoverResult[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRunResponse = {
  run: DesignRun;
};

export type HandoverRequest = {
  designId: string;
};

export type HandoverResponse = {
  handover: HandoverResult;
  run: DesignRun;
};

export type SelectedDesign = {
  candidateId: string;
  runId: string;
  designId: string;
  title: string;
  reason: string;
};

export type DirectCreateHandoverResult = {
  status: 'completed';
  request: DirectCreateHandoverRequest;
  runs: DesignRun[];
  selected: SelectedDesign;
  handover: HandoverResult;
};

export type DirectCreateHandoverResponse = {
  result: DirectCreateHandoverResult;
};

export type LocalUiConnection = {
  origin: string;
  status: 'unchecked' | 'ok' | 'error';
  message: string;
  checkedAt: string | null;
  details?: unknown;
};

export type ConnectionResponse = {
  connection: LocalUiConnection;
};

export type AppStatus = {
  status: 'ok' | 'error';
  checkedAt: string;
  node: {
    status: 'ok';
    message: string;
  };
  codex: {
    installed: boolean;
    version: string | null;
    error: string | null;
  };
  message: string;
};

export type AppStatusResponse = {
  status: AppStatus;
};

export type UpdateConnectionRequest = {
  origin: string;
};

export type CreateWorkspaceStatus = 'idle' | 'seed_running' | 'planning' | 'ready' | 'failed';

export type CreateWorkspacePage = {
  id: string;
  title: string;
  prompt: string;
  order: number;
  variationCount: DirectDesignCount;
  runId: string | null;
  selectedVariationId: string | null;
  handover: HandoverResult | null;
  status: 'planned' | 'running' | 'ready' | 'failed';
  error: string | null;
};

export type CreateWorkspace = {
  id: string;
  status: CreateWorkspaceStatus;
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  aspect: DesignAspect;
  quality: DesignQuality;
  seedVariationCount: DirectDesignCount;
  seedRunId: string | null;
  selectedSeedDesignId: string | null;
  seedHandover: HandoverResult | null;
  pages: CreateWorkspacePage[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkspaceRequest = {
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  seedVariationCount?: DirectDesignCount;
  aspect: DesignAspect;
  quality: DesignQuality;
};

export type CreateWorkspaceResponse = {
  workspace: CreateWorkspace;
};

export type CreateWorkspaceRunResponse = {
  workspace: CreateWorkspace;
  run: DesignRun;
};

export type PlanWorkspacePagesRequest = {
  pagePrompt?: string;
};

export type UpdateWorkspacePageRequest = {
  title?: string;
  prompt?: string;
  variationCount?: DirectDesignCount;
  selectedVariationId?: string | null;
};

export type UpdateWorkspaceSeedSelectionRequest = {
  selectedSeedDesignId: string;
};

export type WorkspaceHandoverResponse = {
  workspace: CreateWorkspace;
  handover: HandoverResult;
};

export type CodexBridgeEventType =
  | 'seed_design_selected'
  | 'page_variation_selected'
  | 'handover_started'
  | 'handover_completed'
  | 'handover_failed';

export type CodexBridgeEvent = {
  id: number;
  at: string;
  workspaceId: string;
  type: CodexBridgeEventType;
  message: string;
  payload: Record<string, unknown>;
};

export type CodexBridgeStatus = {
  workspaceId: string;
  isWaiting: boolean;
  waitingClientCount: number;
  lastEvent: CodexBridgeEvent | null;
  updatedAt: string;
};

export type CodexBridgeStatusResponse = {
  status: CodexBridgeStatus;
};

export type CodexBridgeWaitResponse = {
  status: 'event' | 'timeout' | 'closed';
  event: CodexBridgeEvent | null;
  bridgeStatus: CodexBridgeStatus;
};

export type CodexBridgeContextResponse = {
  workspace: Omit<CreateWorkspace, 'sketchDataUrl' | 'referenceDataUrls'> & {
    hasSketch: boolean;
    referenceCount: number;
  };
  bridgeStatus: CodexBridgeStatus;
};
