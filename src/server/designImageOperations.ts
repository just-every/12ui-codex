import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ImageGenerationOpts } from '@just-every/ensemble';
import type {
  DesignImageEditRequest,
  DesignImageExtensionRequest,
  DesignImageRevision,
  DesignOutput,
  DesignRun,
} from '../shared/types.js';
import { resolveDesignRevisionSource } from '../shared/designImageRevision.js';
import { decodeImageData, readRunAsset, saveImageBuffer, saveImageData } from './assets.js';
import { serverConfig } from './config.js';
import { generateImageDataUrl } from './ensembleImage.js';
import { updateDesign } from './runStore.js';

const MASKED_EDIT_MODEL = 'fal-ai/ideogram/v3/edit';
const MASKED_EDIT_DEFAULT_USER_PROMPT = 'Remove the most obvious items highlighted by the mask.';
const MASKED_EDIT_INSTRUCTION = 'MASK CONSTRAINT: ONLY apply the requested change inside the provided mask. Keep every unmasked area identical to the original source.';
const FULL_IMAGE_EDIT_INSTRUCTION = 'WHOLE IMAGE EDIT: No mask was provided. Apply the requested change to the image as a whole. Preserve unrelated composition, layout, text, colors, and details unless they must change to satisfy the request.';
const EXTENSION_MODEL_QUALITY: ImageGenerationOpts['quality'] = 'medium';

const buildExtensionPrompt = (args: {
  extensionIndex: number;
  nextPagePrompt: string | null;
  originalPrompt: string;
}): string => [
  `You are extending source image 1 only. Source image 1 is the selected webpage viewport immediately above the new viewport you must generate.`,
  `This request is bottom extension #${args.extensionIndex}.`,
  'The provided image is the current visible viewport of a webpage.',
  'Generate exactly one new screenshot showing only the next viewport directly below the provided image.',
  'Treat the bottom edge of the provided image as the scroll boundary: the top pixel row of the new image must begin immediately after the bottom pixel row of the provided image.',
  'No pixel, row, crop, slice, header, hero, image, text, shape, or layout element from the provided viewport may appear in the new image.',
  'Do not include the provided viewport at the top, bottom, or anywhere else in the output.',
  'Do not create an overlap, recap, continuation strip, repeated hero, repeated header, or miniature copy of the provided viewport.',
  'Start with the content that would naturally become visible after scrolling down exactly one viewport.',
  'Use the provided viewport as the page you are extending: the new viewport must feel like the next screen of that exact same page.',
  'Continue the same page, brand, background treatment, spacing rhythm, typography, colors, component style, and visual hierarchy.',
  'This must look like the next screen of the same webpage, not a new page, not a redesign, and not another hero section.',
  args.originalPrompt ? `Original design brief:\n${args.originalPrompt}` : '',
  args.nextPagePrompt ? `User direction for the next viewport: ${args.nextPagePrompt}` : '',
].filter((section) => section.trim()).join('\n\n');

const buildEditPrompt = (requestedPrompt: string | null | undefined, hasMask: boolean): string => {
  const userPrompt = requestedPrompt?.trim() || MASKED_EDIT_DEFAULT_USER_PROMPT;
  if (!hasMask) {
    return [
      'Edit the provided source image according to the brief.',
      `BRIEF: ${userPrompt}`,
      FULL_IMAGE_EDIT_INSTRUCTION,
    ].join('\n\n');
  }
  return [
    'Edit the provided source image according to the brief.',
    `BRIEF: ${userPrompt}`,
    MASKED_EDIT_INSTRUCTION,
  ].join('\n\n');
};

const dataUrlForAsset = async (runId: string, assetPath: string): Promise<string> => {
  const asset = await readRunAsset(runId, assetPath);
  return `data:${asset.contentType};base64,${asset.bytes.toString('base64')}`;
};

const decodeDataUrlBuffer = (dataUrl: string): Buffer => {
  const match = /^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error('Expected image data URL.');
  }
  return Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
};

const imageMetadata = async (bytes: Buffer): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Image dimensions could not be read.');
  }
  return {
    width: metadata.width,
    height: metadata.height,
  };
};

const hasTransparentPixel = (rgba: Buffer): boolean => {
  for (let index = 3; index < rgba.length; index += 4) {
    if ((rgba[index] ?? 255) === 0) return true;
  }
  return false;
};

const validateMaskMatchesSource = async (args: {
  maskDataUrl: string;
  sourceBytes: Buffer;
}): Promise<void> => {
  const maskBytes = decodeDataUrlBuffer(args.maskDataUrl);
  const [source, mask] = await Promise.all([
    imageMetadata(args.sourceBytes),
    imageMetadata(maskBytes),
  ]);
  if (source.width !== mask.width || source.height !== mask.height) {
    throw new Error('Mask dimensions must match the source image.');
  }
  const maskRgba = await sharp(maskBytes).ensureAlpha().raw().toBuffer();
  if (!hasTransparentPixel(maskRgba)) {
    throw new Error('Mask must contain a transparent edit region.');
  }
};

const imageSizeForMetadata = (metadata: { width: number; height: number }): `${number}x${number}` => (
  `${metadata.width}x${metadata.height}` as `${number}x${number}`
);

const revisionModel = (hasMask: boolean): string => hasMask ? MASKED_EDIT_MODEL : serverConfig.imageModel;

const findDesignOrThrow = (run: DesignRun, designId: string): DesignOutput => {
  const design = run.designs.find((entry) => entry.id === designId);
  if (!design) throw new Error('Design not found.');
  return design;
};

const updateDesignRevision = async (args: {
  run: DesignRun;
  designId: string;
  revision: DesignImageRevision;
}): Promise<{ run: DesignRun; design: DesignOutput }> => {
  const run = await updateDesign(args.run.id, args.designId, (design) => ({
    ...design,
    revisions: [...(design.revisions ?? []), args.revision],
    activeRevisionId: args.revision.id,
  }));
  return {
    run,
    design: findDesignOrThrow(run, args.designId),
  };
};

export const createDesignImageEdit = async (args: {
  run: DesignRun;
  designId: string;
  request: DesignImageEditRequest;
}): Promise<{ run: DesignRun; design: DesignOutput; revision: DesignImageRevision }> => {
  const design = findDesignOrThrow(args.run, args.designId);
  const source = resolveDesignRevisionSource(design, args.request.sourceRevisionId);
  const sourceAsset = await readRunAsset(args.run.id, source.assetPath);
  const sourceDataUrl = `data:${sourceAsset.contentType};base64,${sourceAsset.bytes.toString('base64')}`;
  const hasMask = Boolean(args.request.maskDataUrl);
  if (args.request.maskDataUrl) {
    await validateMaskMatchesSource({
      maskDataUrl: args.request.maskDataUrl,
      sourceBytes: sourceAsset.bytes,
    });
  }
  const sourceMetadata = await imageMetadata(sourceAsset.bytes);
  const model = revisionModel(hasMask);
  const image = await generateImageDataUrl({
    model,
    prompt: buildEditPrompt(args.request.prompt, hasMask),
    sketchDataUrl: null,
    referenceDataUrls: [],
    sourceImages: [sourceDataUrl],
    mask: args.request.maskDataUrl ?? undefined,
    size: hasMask ? undefined : imageSizeForMetadata(sourceMetadata),
    quality: args.run.quality,
  });
  const revisionId = randomUUID();
  const saved = await saveImageData(args.run.id, `${args.designId}-edit-${revisionId}`, image);
  const savedMask = args.request.maskDataUrl
    ? await saveImageBuffer(args.run.id, `${args.designId}-edit-${revisionId}-mask`, decodeDataUrlBuffer(args.request.maskDataUrl), 'image/png')
    : null;
  const revision: DesignImageRevision = {
    id: revisionId,
    kind: 'edit',
    assetPath: saved.assetPath,
    prompt: args.request.prompt?.trim() || null,
    model,
    sourceRevisionId: source.revisionId,
    sourceAssetPath: source.assetPath,
    createdAt: new Date().toISOString(),
    maskAssetPath: savedMask?.assetPath ?? null,
  };
  const updated = await updateDesignRevision({
    run: args.run,
    designId: args.designId,
    revision,
  });
  return { ...updated, revision };
};

export const createDesignImageExtension = async (args: {
  run: DesignRun;
  designId: string;
  request: DesignImageExtensionRequest;
}): Promise<{ run: DesignRun; design: DesignOutput; revision: DesignImageRevision }> => {
  if (args.request.direction !== 'bottom') {
    throw new Error('direction must be bottom.');
  }
  const design = findDesignOrThrow(args.run, args.designId);
  const source = resolveDesignRevisionSource(design, args.request.sourceRevisionId);
  const sourceAsset = await readRunAsset(args.run.id, source.assetPath);
  const sourceMetadata = await imageMetadata(sourceAsset.bytes);
  const sourceDataUrl = await dataUrlForAsset(args.run.id, source.assetPath);
  const extensionIndex = (design.revisions ?? []).filter((revision) => revision.kind === 'extension').length + 1;
  const extensionImage = await generateImageDataUrl({
    model: serverConfig.imageModel,
    prompt: buildExtensionPrompt({
      extensionIndex,
      nextPagePrompt: args.request.nextPagePrompt ?? null,
      originalPrompt: args.run.prompt,
    }),
    sketchDataUrl: null,
    referenceDataUrls: [],
    sourceImages: [sourceDataUrl],
    size: imageSizeForMetadata(sourceMetadata),
    quality: EXTENSION_MODEL_QUALITY,
  });
  const revisionId = randomUUID();
  const extension = await decodeImageData(extensionImage);
  const extensionSourceMetadata = await imageMetadata(extension.bytes);
  const normalizedExtension = extensionSourceMetadata.width === sourceMetadata.width
    ? await sharp(extension.bytes).png().toBuffer()
    : await sharp(extension.bytes).resize({ width: sourceMetadata.width }).png().toBuffer();
  const normalizedExtensionMetadata = await imageMetadata(normalizedExtension);
  const sourcePng = await sharp(sourceAsset.bytes).png().toBuffer();
  const composed = await sharp({
    create: {
      width: sourceMetadata.width,
      height: sourceMetadata.height + normalizedExtensionMetadata.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite([
    { input: sourcePng, left: 0, top: 0 },
    { input: normalizedExtension, left: 0, top: sourceMetadata.height },
  ]).png().toBuffer();
  const savedExtension = await saveImageBuffer(args.run.id, `${args.designId}-extension-${revisionId}-part`, normalizedExtension, 'image/png');
  const savedComposed = await saveImageBuffer(args.run.id, `${args.designId}-extension-${revisionId}`, composed, 'image/png');
  const revision: DesignImageRevision = {
    id: revisionId,
    kind: 'extension',
    assetPath: savedComposed.assetPath,
    prompt: args.request.nextPagePrompt?.trim() || null,
    model: serverConfig.imageModel,
    sourceRevisionId: source.revisionId,
    sourceAssetPath: source.assetPath,
    createdAt: new Date().toISOString(),
    extension: {
      direction: 'bottom',
      extensionAssetPath: savedExtension.assetPath,
      sourceWidth: sourceMetadata.width,
      sourceHeight: sourceMetadata.height,
      extensionWidth: normalizedExtensionMetadata.width,
      extensionHeight: normalizedExtensionMetadata.height,
    },
  };
  const updated = await updateDesignRevision({
    run: args.run,
    designId: args.designId,
    revision,
  });
  return { ...updated, revision };
};
