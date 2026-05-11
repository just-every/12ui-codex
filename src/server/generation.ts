import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CreateRunRequest, DesignOutput } from '../shared/types.js';
import { serverConfig } from './config.js';
import { saveImageData } from './assets.js';
import { addDesign, addRunEvent, runDir, setRunStatus } from './runStore.js';
import { generateDesignImageDataUrl } from './ensembleImage.js';
import { planDesignIdeas } from './designPlanning/ideaPlanner.js';
import { planIndividualDesignPrompt } from './designPlanning/individualDesignPlanner.js';
import { textModelLabel } from './textModelRequest.js';

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
      message: `Planning ${request.batchSize} design direction${request.batchSize === 1 ? '' : 's'} with ${textModelLabel()}.`,
      progress: 0.08,
    }, { status: 'running', error: null });

    const designIdeas = await planDesignIdeas(request);
    await writeFile(path.join(runDir(runId), 'idea-plan.json'), `${JSON.stringify(designIdeas, null, 2)}\n`, 'utf8');
    await addRunEvent(runId, {
      type: 'prompting',
      message: `Planning ${request.batchSize} individual design prompt${request.batchSize === 1 ? '' : 's'} with ${textModelLabel()}.`,
      progress: 0.2,
    }, {
      plannedDesigns: designIdeas.map((designIdea) => ({
        branchIndex: designIdea.branchIndex,
        title: designIdea.name,
        prompt: designIdea.direction,
      })),
    });

    const designPrompts = await Promise.all(designIdeas.map(async (designIdea, index) => {
      const designPrompt = await planIndividualDesignPrompt(request, designIdea);
      await addRunEvent(runId, {
        type: 'planned',
        message: `${designPrompt.title} prompt ready.`,
        progress: 0.2 + (index / designIdeas.length) * 0.1,
      });
      const branchIndex = designPrompt.branchIndex;
      const designId = `design-${branchIndex}`;
      await addRunEvent(runId, {
        type: 'generating',
        message: `Generating ${designPrompt.title} with ${serverConfig.imageModel}.`,
        progress: 0.3 + (index / designIdeas.length) * 0.6,
      });
      const image = await generateDesignImageDataUrl({
        prompt: designPrompt.prompt,
        sketchDataUrl: request.sketchDataUrl,
        referenceDataUrls: request.referenceDataUrls,
        size: imageSizeForAspect(request.aspect),
        quality: imageQualityForRequest(request.quality),
      });
      const saved = await saveImageData(runId, designId, image);
      const design: DesignOutput = {
        id: designId,
        branchIndex,
        title: designPrompt.title,
        prompt: designPrompt.prompt,
        assetPath: saved.assetPath,
        model: serverConfig.imageModel,
        createdAt: new Date().toISOString(),
      };
      await addDesign(runId, design);
      await addRunEvent(runId, {
        type: 'generated',
        message: `${designPrompt.title} generated.`,
        progress: 0.3 + ((index + 1) / designIdeas.length) * 0.6,
      });
      return designPrompt;
    }));
    await writeFile(path.join(runDir(runId), 'design-prompts.json'), `${JSON.stringify(designPrompts, null, 2)}\n`, 'utf8');
    await addRunEvent(runId, {
      type: 'planned',
      message: 'Design prompts ready.',
      progress: 0.95,
    }, {
      plannedDesigns: designPrompts.map((designPrompt) => ({
        branchIndex: designPrompt.branchIndex,
        title: designPrompt.title,
        prompt: designPrompt.prompt,
      })),
    });

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
