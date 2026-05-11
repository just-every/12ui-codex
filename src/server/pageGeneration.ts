import type { CreateRunRequest, CreateWorkspace, CreateWorkspacePage } from '../shared/types.js';
import { readRun } from './runStore.js';
import { runDesignDataUrl } from './imageDataUrl.js';

const selectedDesignReference = async (
  runId: string | null,
  designId: string | null,
): Promise<string | null> => {
  if (!runId || !designId) return null;
  const run = await readRun(runId);
  const design = run.designs.find((entry) => entry.id === designId);
  if (!design) return null;
  return runDesignDataUrl(run, design);
};

export const buildPageRunRequest = async (
  workspace: CreateWorkspace,
  page: CreateWorkspacePage,
): Promise<CreateRunRequest> => {
  const seedReference = await selectedDesignReference(workspace.seedRunId, workspace.selectedSeedDesignId);
  const previousPageReferences = await Promise.all(
    workspace.pages
      .filter((entry) => entry.order < page.order)
      .map((entry) => selectedDesignReference(entry.runId, entry.selectedVariationId)),
  );
  const referenceDataUrls = [
    ...workspace.referenceDataUrls,
    ...(seedReference ? [seedReference] : []),
    ...previousPageReferences.filter((entry): entry is string => Boolean(entry)),
  ].slice(0, 8);

  return {
    prompt: [
      `Create the "${page.title}" page for this multi-page 12ui interface.`,
      `Original product prompt: ${workspace.prompt || '(no written prompt)'}`,
      `Page brief: ${page.prompt}`,
      'Keep this page in the same product family as the selected seed design and completed selected pages.',
      'Use references as style guidance. Do not copy page-specific hero imagery or visual scenes unless they are reusable brand elements.',
      'Make the page feel complete and ready for handoff as a browser UI screenshot, without browser chrome.',
    ].join('\n\n'),
    sketchDataUrl: workspace.sketchDataUrl,
    referenceDataUrls,
    batchSize: page.variationCount,
    aspect: workspace.aspect,
    quality: workspace.quality,
    creativityMode: workspace.creativityMode,
  };
};
