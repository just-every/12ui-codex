import {
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
  type ResponseJSONSchema,
} from '@just-every/ensemble';
import type { CreateWorkspace, DesignRun } from '../shared/types.js';
import { projectRoot, serverConfig } from './config.js';
import { runDesignDataUrl } from './imageDataUrl.js';
import { readRun } from './runStore.js';
import { requestTextModelWithFallback } from './textModelRequest.js';

export type PlannedWorkspacePage = {
  id: string;
  title: string;
  prompt: string;
  order: number;
};

const MIN_PLANNED_PAGES = 1;
const MAX_PLANNED_PAGES = 8;
type ResponseContentItem = Extract<ResponseContent, unknown[]>[number];

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

export const parsePagePlan = (raw: string): PlannedWorkspacePage[] => {
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

const workspaceImageContext = async (workspace: CreateWorkspace): Promise<Array<{ label: string; dataUrl: string }>> => {
  const seedDataUrl = await selectedSeedDataUrl(workspace);
  return [
    ...(workspace.sketchDataUrl ? [{ label: 'original sketch', dataUrl: workspace.sketchDataUrl }] : []),
    ...workspace.referenceDataUrls.map((dataUrl, index) => ({ label: `reference asset ${index + 1}`, dataUrl })),
    ...(seedDataUrl ? [{ label: 'selected seed design', dataUrl: seedDataUrl }] : []),
  ];
};

const imageInputs = (images: Array<{ label: string; dataUrl: string }>): ResponseContentItem[] => (
  images.map((image) => ({
    type: 'input_image' as const,
    image_url: image.dataUrl,
    detail: 'high' as const,
  }))
);

export const planWorkspacePages = async (
  workspace: CreateWorkspace,
  pagePrompt?: string,
): Promise<PlannedWorkspacePage[]> => {
  const requestedPagePrompt = pagePrompt?.trim() ?? '';
  const attachedImages = await workspaceImageContext(workspace);
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        'You are planning the remaining pages of a marketing website from a selected homepage/reference-design workflow.',
        `Given the original prompt and optional Add pages input, return the concrete page creation nodes that should be generated next, between ${MIN_PLANNED_PAGES} and ${MAX_PLANNED_PAGES} pages.`,
        'Honor explicit page requests from the Add pages input, including mixed pages like Docs/API.',
        'Do not include a homepage, landing page, home page, hero page, intro page, or renamed version of the selected seed design unless the user explicitly asks for another homepage.',
        'Treat the selected seed design and the original prompt as already-covered source context when they describe the home or landing page. They are style guidance, not pages to regenerate.',
        'Create one node per distinct page. Prefer 3 or 4 pages for empty or simple broad prompts and 3 to 6 pages for broader product/site prompts. Use fewer or more only when the prompt clearly asks for that.',
        'Deduplicate overlapping concepts and choose one representative page type for each group. For example, do not list Product Overview, Features, and How It Works separately unless the prompt clearly requires each distinct page.',
        'Collapse routine legal/account/support links into a single representative page type when they are just standard footer/navigation items.',
        `Original prompt: ${workspace.prompt || '(no written prompt; infer from sketch and assets)'}`,
        `Aspect: ${workspace.aspect}. Quality target: ${workspace.quality}. Creativity mode: ${workspace.creativityMode}.`,
        attachedImages.length > 0
          ? `Attached visual context: ${attachedImages.map((image) => image.label).join(', ')}.`
          : 'No visual context was attached.',
        workspace.pages.length > 0
          ? `Existing pages already in this workspace: ${workspace.pages.map((page) => page.title).join(', ')}. Plan new additions, not duplicates.`
          : 'No additional pages have been planned yet.',
        requestedPagePrompt
          ? `User-requested page addition or page-set goal: ${requestedPagePrompt}`
          : 'The user did not describe pages to add. Decide the strongest compact page set based on the original prompt, selected seed design, and references.',
        'Choose the page count from the prompt and context. For a single clearly requested non-homepage page, return one page. For a product/site flow, return the smallest complete representative page set.',
        'Page 1 should be the most direct and faithful interpretation of the requested page addition, or the strongest system-decided non-homepage addition when the user did not describe one.',
        'Each later page should stay coherent with the same product and design language while becoming more inventive where useful.',
        'Use the selected seed and references for design language only. Do not copy, re-stage, remix, feature, or regenerate page-specific hero artwork, content blocks, decorative art, or exact layouts from references.',
        'Keep each page prompt brief: one or two sentences, usually under 60 words. Include explicit content requirements from the user prompt.',
        'Always carry across explicit style requirements from the Add pages input, even if that makes the page prompt longer.',
        'Also carry across explicit content requirements, such as pricing numbers, product names, API focus, constraints, required sections, or must-have UI/content details.',
        'Do not turn visual observations from the source images into long style instructions. The image generator will see the source images.',
        'Each page prompt should say this is another page on the same site only when useful, then identify the page to generate and the explicit requirements for that page.',
        'Let generation decide most content, layout, visual direction, and details from the provided images.',
        'Return JSON only.',
      ].join('\n\n'),
    },
    ...imageInputs(attachedImages),
  ];
  const messages: ResponseInput = [{ type: 'message', role: 'user', content }];
  const agent: AgentDefinition = {
    cwd: projectRoot,
    instructions: 'You plan concise multi-page interface design briefs. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: pagePlanSchema(),
    },
  };
  return requestTextModelWithFallback({
    agent,
    label: 'Page planning',
    messages,
    parse: parsePagePlan,
  });
};
