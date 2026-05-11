import type {
  CreateRunRequest,
  CreateWorkspaceRequest,
  CreateWorkspaceSeedRunRequest,
  DesignAspect,
  DesignCreativityMode,
  DesignQuality,
  DirectCreateHandoverRequest,
  DirectDesignCount,
  DesignImageEditRequest,
  DesignImageExtensionRequest,
  PlanWorkspacePagesRequest,
  UpdateWorkspacePageRunRequest,
  UpdateDesignActiveRevisionRequest,
  UpdateWorkspacePlannerRequest,
  UpdateWorkspacePageRequest,
  UpdateWorkspaceSeedRunRequest,
  UpdateWorkspaceSeedSelectionRequest,
} from '../shared/types.js';

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,[a-z0-9+/=\s]+$/i;
const MAX_IMAGE_EDIT_PROMPT_CHARS = 2000;
const MAX_IMAGE_EXTENSION_PROMPT_CHARS = 1200;
const MAX_PLANNER_PROMPT_CHARS = 2000;

export const normalizeBatchSize = (value: unknown): number => {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 6 || parsed === 12) return parsed;
  if (value === undefined || value === null || value === '') return 3;
  throw new Error('Batch size must be one of 1, 3, 6, or 12.');
};

export const normalizeDirectDesignCount = (value: unknown): DirectDesignCount => {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 6 || parsed === 12) return parsed;
  if (value === undefined || value === null || value === '') return 3;
  throw new Error('Direct design count must be one of 1, 3, 6, or 12.');
};

export const normalizeAspect = (value: unknown): DesignAspect => (
  value === 'landscape' ? 'landscape' : 'portrait'
);

export const normalizeQuality = (value: unknown): DesignQuality => {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
};

export const normalizeCreativityMode = (value: unknown): DesignCreativityMode => (
  value === 'creative' || value === 'explorer' ? 'creative' : 'standard'
);

export const isImageDataUrl = (value: unknown): value is string => (
  typeof value === 'string' && DATA_URL_PATTERN.test(value.trim())
);

export const isPngDataUrl = (value: unknown): value is string => (
  typeof value === 'string' && PNG_DATA_URL_PATTERN.test(value.trim())
);

export const normalizeReferenceDataUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => isImageDataUrl(entry) ? entry.trim() : null).filter((entry): entry is string => Boolean(entry));
};

export const parseCreateRunRequest = (value: unknown): CreateRunRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  const sketchDataUrl = isImageDataUrl(record.sketchDataUrl) ? record.sketchDataUrl.trim() : null;
  if (!prompt && !sketchDataUrl) {
    throw new Error('Prompt or sketch is required.');
  }
  return {
    prompt,
    sketchDataUrl,
    referenceDataUrls: normalizeReferenceDataUrls(record.referenceDataUrls ?? record.assets ?? record.assetDataUrls),
    batchSize: normalizeBatchSize(record.batchSize),
    aspect: normalizeAspect(record.aspect),
    quality: normalizeQuality(record.quality),
    creativityMode: normalizeCreativityMode(record.creativityMode),
  };
};

export const parseCreateWorkspaceRequest = (value: unknown): CreateWorkspaceRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  const sketchDataUrl = isImageDataUrl(record.sketchDataUrl) ? record.sketchDataUrl.trim() : null;
  if (!prompt && !sketchDataUrl) {
    throw new Error('Prompt or sketch is required.');
  }
  return {
    prompt,
    sketchDataUrl,
    referenceDataUrls: normalizeReferenceDataUrls(record.referenceDataUrls ?? record.assets ?? record.assetDataUrls),
    seedVariationCount: normalizeDirectDesignCount(record.seedVariationCount ?? record.batchSize),
    aspect: normalizeAspect(record.aspect),
    quality: normalizeQuality(record.quality),
    creativityMode: normalizeCreativityMode(record.creativityMode),
  };
};

export const parseCreateWorkspaceSeedRunRequest = (value: unknown): CreateWorkspaceSeedRunRequest => {
  const request = parseCreateWorkspaceRequest(value);
  return {
    ...request,
    seedVariationCount: request.seedVariationCount ?? 3,
  };
};

export const parsePlanWorkspacePagesRequest = (value: unknown): PlanWorkspacePagesRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const pagePrompt = typeof record.pagePrompt === 'string'
    ? record.pagePrompt.trim()
    : typeof record.prompt === 'string'
      ? record.prompt.trim()
      : '';
  return {
    ...(pagePrompt ? { pagePrompt } : {}),
  };
};

export const parseUpdateWorkspacePlannerRequest = (value: unknown): UpdateWorkspacePlannerRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const patch: UpdateWorkspacePlannerRequest = {};
  if ('plannerVisible' in record) {
    if (typeof record.plannerVisible !== 'boolean') {
      throw new Error('plannerVisible must be a boolean.');
    }
    patch.plannerVisible = record.plannerVisible;
  }
  if ('plannerPrompt' in record) {
    const plannerPrompt = typeof record.plannerPrompt === 'string' ? record.plannerPrompt.trim() : '';
    if (plannerPrompt.length > MAX_PLANNER_PROMPT_CHARS) {
      throw new Error('plannerPrompt is too long.');
    }
    patch.plannerPrompt = plannerPrompt;
  }
  return patch;
};

export const parseUpdateWorkspacePageRequest = (value: unknown): UpdateWorkspacePageRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const patch: UpdateWorkspacePageRequest = {};
  if ('title' in record) {
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!title) throw new Error('Page title cannot be empty.');
    patch.title = title;
  }
  if ('prompt' in record) {
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    if (!prompt) throw new Error('Page prompt cannot be empty.');
    patch.prompt = prompt;
  }
  if ('variationCount' in record) {
    patch.variationCount = normalizeDirectDesignCount(record.variationCount);
  }
  if ('selectedVariationId' in record) {
    if (record.selectedVariationId === null || record.selectedVariationId === '') {
      patch.selectedVariationId = null;
    } else {
      patch.selectedVariationId = parseDesignId(record.selectedVariationId);
    }
  }
  return patch;
};

export const parseUpdateWorkspaceSeedSelectionRequest = (value: unknown): UpdateWorkspaceSeedSelectionRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { selectedSeedDesignId: parseDesignId(record.selectedSeedDesignId ?? record.designId) };
};

export const parseUpdateWorkspaceSeedRunRequest = (value: unknown): UpdateWorkspaceSeedRunRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { runId: parseRunId(record.runId) };
};

export const parseUpdateWorkspacePageRunRequest = (value: unknown): UpdateWorkspacePageRunRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return { runId: parseRunId(record.runId) };
};

const parseRevisionId = (value: unknown): string => {
  const revisionId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-z0-9-]{3,120}$/i.test(revisionId)) {
    throw new Error('A valid revision id is required.');
  }
  return revisionId;
};

const parseOptionalRevisionId = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseRevisionId(value);
};

export const parseDesignImageEditRequest = (value: unknown): DesignImageEditRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  if (prompt.length > MAX_IMAGE_EDIT_PROMPT_CHARS) {
    throw new Error('Edit prompt is too long.');
  }
  const maskDataUrl = record.maskDataUrl === null || record.maskDataUrl === ''
    ? null
    : isPngDataUrl(record.maskDataUrl)
      ? record.maskDataUrl.trim()
      : undefined;
  if ('maskDataUrl' in record && record.maskDataUrl && !maskDataUrl) {
    throw new Error('maskDataUrl must be a PNG data URL.');
  }
  if (!maskDataUrl && !prompt) {
    throw new Error('Prompt is required when editing the full image.');
  }
  return {
    prompt: prompt || null,
    maskDataUrl: maskDataUrl ?? null,
    sourceRevisionId: parseOptionalRevisionId(record.sourceRevisionId),
  };
};

export const parseDesignImageExtensionRequest = (value: unknown): DesignImageExtensionRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if (record.direction !== 'bottom') {
    throw new Error('direction must be bottom.');
  }
  const nextPagePrompt = typeof record.nextPagePrompt === 'string'
    ? record.nextPagePrompt.trim()
    : typeof record.prompt === 'string'
      ? record.prompt.trim()
      : '';
  if (nextPagePrompt.length > MAX_IMAGE_EXTENSION_PROMPT_CHARS) {
    throw new Error('nextPagePrompt is too long.');
  }
  return {
    direction: 'bottom',
    nextPagePrompt: nextPagePrompt || null,
    sourceRevisionId: parseOptionalRevisionId(record.sourceRevisionId),
  };
};

export const parseUpdateDesignActiveRevisionRequest = (value: unknown): UpdateDesignActiveRevisionRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  if (!('activeRevisionId' in record)) {
    throw new Error('activeRevisionId is required.');
  }
  return {
    activeRevisionId: parseOptionalRevisionId(record.activeRevisionId) ?? null,
  };
};

export const parseDirectCreateHandoverRequest = (value: unknown): DirectCreateHandoverRequest => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  const sketchDataUrl = isImageDataUrl(record.sketchDataUrl) ? record.sketchDataUrl.trim() : null;
  if (!prompt && !sketchDataUrl) {
    throw new Error('Prompt or sketch is required.');
  }
  return {
    prompt,
    sketchDataUrl,
    referenceDataUrls: normalizeReferenceDataUrls(record.referenceDataUrls ?? record.assets ?? record.assetDataUrls),
    designCount: normalizeDirectDesignCount(record.designCount ?? record.count ?? record.batchSize),
    aspect: normalizeAspect(record.aspect),
    quality: normalizeQuality(record.quality),
    creativityMode: normalizeCreativityMode(record.creativityMode),
  };
};

export const parseDesignId = (value: unknown): string => {
  const designId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-z0-9-]{3,80}$/i.test(designId)) {
    throw new Error('A valid designId is required.');
  }
  return designId;
};

export const parseRunId = (value: unknown): string => {
  const runId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-z0-9-]{3,80}$/i.test(runId)) {
    throw new Error('A valid runId is required.');
  }
  return runId;
};

export const parseWorkspaceId = (value: string): string => {
  const workspaceId = decodeURIComponent(value).trim();
  if (!/^[a-z0-9-]{8,80}$/i.test(workspaceId)) {
    throw new Error('A valid workspace id is required.');
  }
  return workspaceId;
};

export const parsePageId = (value: string): string => {
  const pageId = decodeURIComponent(value).trim();
  if (!/^[a-z0-9-]{3,80}$/i.test(pageId)) {
    throw new Error('A valid page id is required.');
  }
  return pageId;
};
