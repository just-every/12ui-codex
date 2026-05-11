import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDesignAssetPath } from '../shared/designImageRevision.js';
import { readRunAsset, saveImageBuffer } from './assets.js';
import { addDesign, createRunRecord, readRun, runDir } from './runStore.js';
import { createDesignImageEdit, createDesignImageExtension } from './designImageOperations.js';

const mocks = vi.hoisted(() => ({
  generateImageDataUrl: vi.fn(),
}));

vi.mock('./ensembleImage.js', () => ({
  generateImageDataUrl: mocks.generateImageDataUrl,
}));

const runDirs: string[] = [];

const pngDataUrl = async (color: { r: number; g: number; b: number; alpha?: number }): Promise<string> => {
  const bytes = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { ...color, alpha: color.alpha ?? 1 },
    },
  }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString('base64')}`;
};

const transparentMaskDataUrl = async (): Promise<string> => {
  const rgba = Buffer.from([
    255, 255, 255, 0,
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ]);
  const bytes = await sharp(rgba, {
    raw: {
      width: 2,
      height: 2,
      channels: 4,
    },
  }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString('base64')}`;
};

const createRunWithDesign = async () => {
  const run = await createRunRecord({
    prompt: 'Create a checkout page.',
    batchSize: 1,
    aspect: 'portrait',
    quality: 'high',
    creativityMode: 'standard',
  });
  runDirs.push(runDir(run.id));
  const source = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  }).png().toBuffer();
  const saved = await saveImageBuffer(run.id, 'design-1', source, 'image/png');
  await addDesign(run.id, {
    id: 'design-1',
    branchIndex: 1,
    title: 'Design 1',
    prompt: 'Prompt',
    assetPath: saved.assetPath,
    model: 'codex-gpt-image-2',
    createdAt: '2026-05-11T00:00:00.000Z',
  });
  return readRun(run.id);
};

describe('design image operations', () => {
  beforeEach(() => {
    mocks.generateImageDataUrl.mockReset();
  });

  afterEach(async () => {
    await Promise.all(runDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('creates masked edit revisions through the masked edit model', async () => {
    const run = await createRunWithDesign();
    mocks.generateImageDataUrl.mockResolvedValue(await pngDataUrl({ r: 0, g: 0, b: 255 }));
    const result = await createDesignImageEdit({
      run,
      designId: 'design-1',
      request: {
        prompt: null,
        maskDataUrl: await transparentMaskDataUrl(),
      },
    });

    expect(mocks.generateImageDataUrl).toHaveBeenCalledWith(expect.objectContaining({
      model: 'fal-ai/ideogram/v3/edit',
      mask: expect.stringMatching(/^data:image\/png;base64,/),
      sourceImages: [expect.stringMatching(/^data:image\/png;base64,/)],
    }));
    expect(result.revision.kind).toBe('edit');
    expect(resolveDesignAssetPath(result.design)).toBe(result.revision.assetPath);
    expect(result.design.activeRevisionId).toBe(result.revision.id);
    expect(result.revision.maskAssetPath).toMatch(/^assets\/design-1-edit-.*-mask\.png$/);
  });

  it('surfaces provider failures without changing the design', async () => {
    const run = await createRunWithDesign();
    mocks.generateImageDataUrl.mockRejectedValue(new Error('provider down'));

    await expect(createDesignImageEdit({
      run,
      designId: 'design-1',
      request: {
        prompt: 'make it calmer',
        maskDataUrl: null,
      },
    })).rejects.toThrow('provider down');

    const persisted = await readRun(run.id);
    expect(persisted.designs[0]?.revisions).toBeUndefined();
    expect(persisted.designs[0]?.activeRevisionId).toBeUndefined();
  });

  it('creates bottom extension revisions as vertically composed images', async () => {
    const run = await createRunWithDesign();
    mocks.generateImageDataUrl.mockResolvedValue(await pngDataUrl({ r: 0, g: 255, b: 0 }));
    const result = await createDesignImageExtension({
      run,
      designId: 'design-1',
      request: {
        direction: 'bottom',
        nextPagePrompt: 'show pricing',
      },
    });

    expect(mocks.generateImageDataUrl).toHaveBeenCalledWith(expect.objectContaining({
      model: 'codex-gpt-image-2',
      prompt: expect.stringContaining('Generate exactly one new screenshot showing only the next viewport directly below'),
      sourceImages: [expect.stringMatching(/^data:image\/png;base64,/)],
    }));
    const asset = await readRunAsset(result.run.id, result.revision.assetPath);
    const metadata = await sharp(asset.bytes).metadata();
    expect(metadata.width).toBe(2);
    expect(metadata.height).toBe(4);
    expect(result.revision.extension).toMatchObject({
      direction: 'bottom',
      sourceWidth: 2,
      sourceHeight: 2,
      extensionWidth: 2,
      extensionHeight: 2,
    });
  });
});
