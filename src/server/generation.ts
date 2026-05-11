import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ensembleRequest,
  ensembleResult,
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
  type ResponseJSONSchema,
} from '@just-every/ensemble';
import type { CreateRunRequest, DesignOutput } from '../shared/types.js';
import { projectRoot, serverConfig } from './config.js';
import { saveImageData } from './assets.js';
import { addDesign, addRunEvent, runDir, setRunStatus } from './runStore.js';
import { generateDesignImageDataUrl } from './ensembleImage.js';
import { baseCreateGuidance, plannerGuidance } from './promptGuidance.js';

type BranchPrompt = {
  title: string;
  prompt: string;
};

const planningSchema = (count: number): ResponseJSONSchema => ({
  type: 'json_schema',
  name: 'codex_12ui_branch_prompts',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      designs: {
        type: 'array',
        minItems: count,
        maxItems: count,
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
    required: ['designs'],
  },
});

const parseBranchPrompts = (raw: string, count: number): BranchPrompt[] => {
  const parsed = JSON.parse(raw) as { designs?: unknown };
  if (!Array.isArray(parsed.designs) || parsed.designs.length !== count) {
    throw new Error(`Planner returned ${Array.isArray(parsed.designs) ? parsed.designs.length : 0} designs; expected ${count}.`);
  }
  return parsed.designs.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Planner design ${index + 1} is not an object.`);
    }
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    if (!title || !prompt) {
      throw new Error(`Planner design ${index + 1} is missing a title or prompt.`);
    }
    return { title, prompt };
  });
};

export const planBranchPrompts = async (request: CreateRunRequest): Promise<BranchPrompt[]> => {
  const attachedImages = [
    ...(request.sketchDataUrl ? [{ label: 'sketch', dataUrl: request.sketchDataUrl }] : []),
    ...request.referenceDataUrls.map((dataUrl, index) => ({ label: `reference asset ${index + 1}`, dataUrl })),
  ];
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        `Create exactly ${request.batchSize} distinct design directions for a browser-based 12ui sketch-to-interface tool.`,
        `User prompt: ${request.prompt || '(no written prompt; use the attached sketch/assets as the primary direction)'}`,
        `Aspect: ${request.aspect}. Quality target: ${request.quality}.`,
        attachedImages.length > 0
          ? `Attached visual context: ${attachedImages.map((image) => image.label).join(', ')}.`
          : 'No visual context was attached.',
        baseCreateGuidance,
        plannerGuidance,
        'Return JSON only.',
      ].join('\n\n'),
    },
    ...attachedImages.map((image) => ({
      type: 'input_image' as const,
      image_url: image.dataUrl,
      detail: 'high' as const,
    })),
  ];
  const messages: ResponseInput = [{
    type: 'message',
    role: 'user',
    content,
  }];
  const agent: AgentDefinition = {
    model: serverConfig.textModel,
    cwd: projectRoot,
    instructions: 'You plan concise image-generation prompts for web interface design. Do not invent unavailable assets. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: planningSchema(request.batchSize),
    },
  };
  const result = await ensembleResult(ensembleRequest(messages, agent));
  if (result.error) throw new Error(result.error);
  return parseBranchPrompts(result.message, request.batchSize);
};

const imageSizeForAspect = (aspect: CreateRunRequest['aspect']): '1024x1536' | '1536x1024' => (
  aspect === 'landscape' ? '1536x1024' : '1024x1536'
);

const imageQualityForRequest = (quality: CreateRunRequest['quality']): 'low' | 'medium' | 'high' => quality;

export const startGeneration = async (runId: string, request: CreateRunRequest): Promise<void> => {
  try {
    await writeFile(path.join(runDir(runId), 'request.json'), `${JSON.stringify(request, null, 2)}\n`, 'utf8');
    if (request.sketchDataUrl) {
      const sketchBase64 = request.sketchDataUrl.replace(/^data:[^;]+;base64,/i, '');
      await writeFile(path.join(runDir(runId), 'sketch.png'), Buffer.from(sketchBase64, 'base64'));
    }
    await Promise.all(request.referenceDataUrls.map(async (referenceDataUrl, index) => {
      const referenceBase64 = referenceDataUrl.replace(/^data:[^;]+;base64,/i, '');
      await writeFile(path.join(runDir(runId), `reference-${index + 1}.png`), Buffer.from(referenceBase64, 'base64'));
    }));
    await addRunEvent(runId, {
      type: 'planning',
      message: `Planning ${request.batchSize} design direction${request.batchSize === 1 ? '' : 's'} with ${serverConfig.textModel}.`,
      progress: 0.08,
    }, { status: 'running', error: null });

    const branchPrompts = await planBranchPrompts(request);
    await writeFile(path.join(runDir(runId), 'branch-prompts.json'), `${JSON.stringify(branchPrompts, null, 2)}\n`, 'utf8');
    await addRunEvent(runId, {
      type: 'planned',
      message: 'Branch prompts ready.',
      progress: 0.2,
    }, {
      plannedDesigns: branchPrompts.map((branch, index) => ({
        branchIndex: index + 1,
        title: branch.title,
        prompt: branch.prompt,
      })),
    });

    await Promise.all(branchPrompts.map(async (branch, index) => {
      const branchIndex = index + 1;
      const designId = `design-${branchIndex}`;
      await addRunEvent(runId, {
        type: 'generating',
        message: `Generating ${branch.title} with ${serverConfig.imageModel}.`,
        progress: 0.2 + (index / branchPrompts.length) * 0.7,
      });
      const imagePrompt = [
        baseCreateGuidance,
        request.prompt ? `User prompt: ${request.prompt}` : '',
        `Design direction: ${branch.title}`,
        branch.prompt,
      ].filter(Boolean).join('\n\n');
      const image = await generateDesignImageDataUrl({
        prompt: imagePrompt,
        sketchDataUrl: request.sketchDataUrl,
        referenceDataUrls: request.referenceDataUrls,
        size: imageSizeForAspect(request.aspect),
        quality: imageQualityForRequest(request.quality),
      });
      const saved = await saveImageData(runId, designId, image);
      const design: DesignOutput = {
        id: designId,
        branchIndex,
        title: branch.title,
        prompt: branch.prompt,
        assetPath: saved.assetPath,
        model: serverConfig.imageModel,
        createdAt: new Date().toISOString(),
      };
      await addDesign(runId, design);
      await addRunEvent(runId, {
        type: 'generated',
        message: `${branch.title} generated.`,
        progress: 0.2 + (branchIndex / branchPrompts.length) * 0.7,
      });
    }));

    await addRunEvent(runId, {
      type: 'completed',
      message: 'Design batch complete.',
      progress: 1,
    }, { status: 'completed', error: null, progress: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Generation failed.');
    await addRunEvent(runId, {
      type: 'failed',
      message,
      progress: 1,
    }, { status: 'failed', error: message, progress: 1 });
    await setRunStatus(runId, 'failed', 1, message);
  }
};
