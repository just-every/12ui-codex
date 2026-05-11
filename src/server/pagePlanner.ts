import {
  ensembleRequest,
  ensembleResult,
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
  type ResponseJSONSchema,
} from '@just-every/ensemble';
import type { CreateWorkspace, DesignRun } from '../shared/types.js';
import { projectRoot, serverConfig } from './config.js';
import { runDesignDataUrl } from './imageDataUrl.js';
import { readRun } from './runStore.js';

export type PlannedWorkspacePage = {
  id: string;
  title: string;
  prompt: string;
  order: number;
};

const MIN_PLANNED_PAGES = 1;
const MAX_PLANNED_PAGES = 8;

const pagePlanSchema = (): ResponseJSONSchema => ({
  type: 'json_schema',
  name: 'codex_12ui_page_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      pages: {
        type: 'array',
        minItems: MIN_PLANNED_PAGES,
        maxItems: MAX_PLANNED_PAGES,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['title', 'prompt'],
        },
      },
    },
    required: ['pages'],
  },
});

const slugPageId = (title: string, index: number): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `${slug || 'page'}-${index + 1}`;
};

const parsePagePlan = (raw: string): PlannedWorkspacePage[] => {
  const parsed = JSON.parse(raw) as { pages?: unknown };
  if (!Array.isArray(parsed.pages) || parsed.pages.length < MIN_PLANNED_PAGES || parsed.pages.length > MAX_PLANNED_PAGES) {
    throw new Error(`Planner returned ${Array.isArray(parsed.pages) ? parsed.pages.length : 0} pages; expected ${MIN_PLANNED_PAGES}-${MAX_PLANNED_PAGES}.`);
  }
  return parsed.pages.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Planner page ${index + 1} is not an object.`);
    }
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    if (!title || !prompt) {
      throw new Error(`Planner page ${index + 1} is missing a title or prompt.`);
    }
    return {
      id: slugPageId(title, index),
      title,
      prompt,
      order: index + 1,
    };
  });
};

const selectedSeedDataUrl = async (workspace: CreateWorkspace): Promise<string | null> => {
  if (!workspace.seedRunId || !workspace.selectedSeedDesignId) return null;
  const seedRun: DesignRun = await readRun(workspace.seedRunId);
  const selected = seedRun.designs.find((design) => design.id === workspace.selectedSeedDesignId);
  if (!selected) return null;
  return runDesignDataUrl(seedRun, selected);
};

export const planWorkspacePages = async (
  workspace: CreateWorkspace,
  pagePrompt?: string,
): Promise<PlannedWorkspacePage[]> => {
  const seedDataUrl = await selectedSeedDataUrl(workspace);
  const requestedPagePrompt = pagePrompt?.trim() ?? '';
  const attachedImages = [
    ...(workspace.sketchDataUrl ? [{ label: 'original sketch', dataUrl: workspace.sketchDataUrl }] : []),
    ...workspace.referenceDataUrls.map((dataUrl, index) => ({ label: `reference asset ${index + 1}`, dataUrl })),
    ...(seedDataUrl ? [{ label: 'selected seed design', dataUrl: seedDataUrl }] : []),
  ];
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        `Plan the right number of user-facing pages for a 12ui design workflow, between ${MIN_PLANNED_PAGES} and ${MAX_PLANNED_PAGES} pages.`,
        `Original prompt: ${workspace.prompt || '(no written prompt; infer from sketch and assets)'}`,
        `Aspect: ${workspace.aspect}. Quality target: ${workspace.quality}.`,
        attachedImages.length > 0
          ? `Attached visual context: ${attachedImages.map((image) => image.label).join(', ')}.`
          : 'No visual context was attached.',
        workspace.pages.length > 0
          ? `Existing pages already in this workspace: ${workspace.pages.map((page) => page.title).join(', ')}. Plan new additions, not duplicates.`
          : 'No additional pages have been planned yet.',
        requestedPagePrompt
          ? `User-requested page addition or page-set goal: ${requestedPagePrompt}`
          : 'The user did not describe pages to add. Decide the strongest page set based on the original prompt and selected seed design.',
        'Choose the page count from the prompt. For a single clearly requested page, return one page. For a product/site flow, return the smallest complete page set.',
        'Page 1 should be the most direct and faithful interpretation of the requested page addition, or the strongest system-decided addition when the user did not describe one.',
        'Each later page should stay coherent with the same product and design language while becoming more inventive where useful.',
        'Use the selected seed and references for design language only. Do not copy or re-stage page-specific hero artwork unless the user explicitly requested reusable brand imagery.',
        'Each page prompt must be ready for image generation: describe layout, hierarchy, visual language, content density, and interaction states.',
        'Prefer full-bleed imagery only when it carries the story by itself; keep overlaid text large, sparse, and readable.',
        'Return JSON only.',
      ].join('\n\n'),
    },
    ...attachedImages.map((image) => ({
      type: 'input_image' as const,
      image_url: image.dataUrl,
      detail: 'high' as const,
    })),
  ];
  const messages: ResponseInput = [{ type: 'message', role: 'user', content }];
  const agent: AgentDefinition = {
    model: serverConfig.textModel,
    cwd: projectRoot,
    instructions: 'You plan concise multi-page interface design briefs. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: pagePlanSchema(),
    },
  };
  const result = await ensembleResult(ensembleRequest(messages, agent));
  if (result.error) throw new Error(result.error);
  return parsePagePlan(result.message);
};
