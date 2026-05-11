import { ensembleImage, type AgentDefinition, type ImageGenerationOpts } from '@just-every/ensemble';
import { projectRoot, serverConfig } from './config.js';

export const generateDesignImageDataUrl = async (args: {
  prompt: string;
  sketchDataUrl: string | null;
  referenceDataUrls: string[];
  size: ImageGenerationOpts['size'];
  quality: ImageGenerationOpts['quality'];
}): Promise<string> => {
  const agent: AgentDefinition = {
    agent_id: 'codex-12ui-image-generation',
    model: serverConfig.imageModel,
    cwd: projectRoot,
    modelSettings: {
      codex_home: serverConfig.codexHome,
    },
  };
  const sourceImages = [
    ...(args.sketchDataUrl ? [args.sketchDataUrl] : []),
    ...args.referenceDataUrls,
  ];
  const options: ImageGenerationOpts = {
    n: 1,
    size: args.size,
    quality: args.quality,
    source_images: sourceImages.length > 0 ? sourceImages : undefined,
  };
  const images = await (ensembleImage(args.prompt, agent, options) as Promise<string[]>);
  if (images.length !== 1 || !images[0]?.startsWith('data:image/')) {
    throw new Error(`Ensemble image generation returned ${images.length} images; expected one image data URL.`);
  }
  return images[0];
};
