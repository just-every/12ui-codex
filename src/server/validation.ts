import type {
  CreateRunRequest,
  CreateWorkspaceRequest,
  DesignAspect,
  DesignQuality,
  DirectCreateHandoverRequest,
  DirectDesignCount,
  PlanWorkspacePagesRequest,
  UpdateWorkspacePageRequest,
  UpdateWorkspaceSeedSelectionRequest,
} from '../shared/types.js';

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;

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

export const isImageDataUrl = (value: unknown): value is string => (
  typeof value === 'string' && DATA_URL_PATTERN.test(value.trim())
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
  };
};

export const parseDesignId = (value: unknown): string => {
  const designId = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-z0-9-]{3,80}$/i.test(designId)) {
    throw new Error('A valid designId is required.');
  }
  return designId;
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
