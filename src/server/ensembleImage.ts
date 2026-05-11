import { ensembleImage, type AgentDefinition, type ImageGenerationOpts } from '@just-every/ensemble';
import { projectRoot, serverConfig } from './config.js';

type CodexPromptedImageGenerationOpts = ImageGenerationOpts & {
  prompt_model?: string;
  prompt_model_fallbacks?: string[];
};

export const generateImageDataUrl = async (args: {
  model: string;
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  size: ImageGenerationOpts['size'];
  quality: ImageGenerationOpts['quality'];
  sourceImages?: ImageGenerationOpts['source_images'];
  mask?: string;
}): Promise<string> => {
  const agent: AgentDefinition = {
    agent_id: 'codex-12ui-image-generation',
    model: args.model,
    cwd: projectRoot,
    modelSettings: {
      codex_home: serverConfig.codexHome,
    },
  };
  const sourceImages = [
    ...(args.sketchDataUrl ? [args.sketchDataUrl] : []),
    ...args.referenceDataUrls,
  ];
  const options: CodexPromptedImageGenerationOpts = {
    n: 1,
    size: args.size,
    quality: args.quality,
    prompt_model: serverConfig.imagePromptModel,
    prompt_model_fallbacks: serverConfig.imagePromptFallbackModels,
    source_images: args.sourceImages ?? (sourceImages.length > 0 ? sourceImages : undefined),
    mask: args.mask,
  };
  const images = await (ensembleImage(args.prompt, agent, options) as Promise<string[]>);
  if (images.length !== 1 || !images[0]?.startsWith('data:image/')) {
    throw new Error(`Ensemble image generation returned ${images.length} images; expected one image data URL.`);
  }
  return images[0];
};

export const generateDesignImageDataUrl = async (args: {
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  size: ImageGenerationOpts['size'];
  quality: ImageGenerationOpts['quality'];
}): Promise<string> => generateImageDataUrl({
  model: serverConfig.imageModel,
  ...args,
});
