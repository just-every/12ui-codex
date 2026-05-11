import type {
  CreateWorkspace,
  CreateWorkspacePage,
  DesignAspect,
  DesignOutput,
  DesignQuality,
  DesignRun,
  DirectDesignCount,
  LocalUiConnection,
  WorkspaceHandoverResponse,
} from '../../shared/types.js';

export type RunMap = Record<string, DesignRun | undefined>;

export type GenerationDraft = {
  prompt: string;
  seedVariationCount: DirectDesignCount;
  aspect: DesignAspect;
  quality: DesignQuality;
  hasSketch: boolean;
  referenceCount: number;
};

export type SeedNodeActions = {
  setPrompt: (prompt: string) => void;
  setSeedVariationCount: (count: DirectDesignCount) => void;
  setAspect: (aspect: DesignAspect) => void;
  setQuality: (quality: DesignQuality) => void;
  onReferenceFiles: (files: FileList | null) => void;
  onClearReferences: () => void;
  onCreateSeed: () => void;
  onClearSketch: () => void;
};

export type PlannerNodeActions = {
  onPlanPages: (pagePrompt?: string) => void;
};

export type PageNodeActions = {
  onUpdatePage: (pageId: string, patch: Partial<Pick<CreateWorkspacePage, 'title' | 'prompt' | 'variationCount' | 'selectedVariationId'>>) => void;
  onCreatePageRun: (pageId: string) => void;
};

export type ExportNodeActions = {
  onCreateSeedHandover: () => Promise<WorkspaceHandoverResponse>;
  onCreateHandover: (pageId: string) => Promise<WorkspaceHandoverResponse>;
  onSendTextHandoff: (handoffText: string, selectedImages: unknown[]) => Promise<void>;
  connectionOrigin: string;
  setConnectionOrigin: (origin: string) => void;
  onConnect: () => void;
};

export type VariantSelection = {
  workspace: CreateWorkspace | null;
  run: DesignRun | null;
  design: DesignOutput;
  selected: boolean;
  onSelect: () => void;
};

export type ConnectionState = {
  connection: LocalUiConnection | null;
  isConnecting: boolean;
};
