import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunRecord, runDir } from './runStore.js';
import { readRunAsset, saveImageBuffer } from './assets.js';

const runDirs: string[] = [];

describe('assets', () => {
  afterEach(async () => {
    await Promise.all(runDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('returns cache validators for persisted run assets', async () => {
    const run = await createRunRecord({
      prompt: 'Test',
      batchSize: 1,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
    runDirs.push(runDir(run.id));
    const saved = await saveImageBuffer(run.id, 'design-1', Buffer.from('image-bytes'), 'image/png');

    const asset = await readRunAsset(run.id, saved.assetPath);

    expect(asset.bytes.toString('utf8')).toBe('image-bytes');
    expect(asset.contentLength).toBe(Buffer.byteLength('image-bytes'));
    expect(asset.contentType).toBe('image/png');
    expect(asset.etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(Date.parse(asset.lastModified)).not.toBeNaN();
  });
});
