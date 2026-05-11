import type { DesignImageRevision, DesignOutput } from './types.js';

export type ResolvedDesignImage = {
  assetPath: string;
  revision: DesignImageRevision | null;
  revisionId: string | null;
};

export const designBaseRevisionId = (design: Pick<DesignOutput, 'id'>): string => `${design.id}:base`;

export const resolveDesignActiveRevision = (design: DesignOutput): DesignImageRevision | null => {
  if (!design.activeRevisionId) return null;
  const revision = design.revisions?.find((entry) => entry.id === design.activeRevisionId) ?? null;
  if (!revision) {
    throw new Error(`Active revision ${design.activeRevisionId} was not found for design ${design.id}.`);
  }
  return revision;
};

export const resolveDesignImage = (design: DesignOutput): ResolvedDesignImage => {
  const revision = resolveDesignActiveRevision(design);
  return {
    assetPath: revision?.assetPath ?? design.assetPath,
    revision,
    revisionId: revision?.id ?? null,
  };
};

export const resolveDesignAssetPath = (design: DesignOutput): string => resolveDesignImage(design).assetPath;

export const resolveDesignRevisionSource = (
  design: DesignOutput,
  sourceRevisionId?: string | null,
): ResolvedDesignImage => {
  if (sourceRevisionId === undefined) return resolveDesignImage(design);
  if (!sourceRevisionId) {
    return {
      assetPath: design.assetPath,
      revision: null,
      revisionId: null,
    };
  }
  const revision = design.revisions?.find((entry) => entry.id === sourceRevisionId) ?? null;
  if (!revision) {
    throw new Error(`Source revision ${sourceRevisionId} was not found for design ${design.id}.`);
  }
  return {
    assetPath: revision.assetPath,
    revision,
    revisionId: revision.id,
  };
};

export const designImageHistory = (design: DesignOutput): ResolvedDesignImage[] => [
  {
    assetPath: design.assetPath,
    revision: null,
    revisionId: null,
  },
  ...(design.revisions ?? []).map((revision) => ({
    assetPath: revision.assetPath,
    revision,
    revisionId: revision.id,
  })),
];

export const resolveDesignHistoryIndex = (design: DesignOutput): number => {
  if (!design.activeRevisionId) return 0;
  const index = (design.revisions ?? []).findIndex((revision) => revision.id === design.activeRevisionId);
  if (index < 0) {
    throw new Error(`Active revision ${design.activeRevisionId} was not found for design ${design.id}.`);
  }
  return index + 1;
};
