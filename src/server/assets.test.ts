import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRunAsset } from './assets.js';
import { runDir } from './runStore.js';

const testRunId = '11111111-1111-4111-8111-111111111111';
const runDirs: string[] = [];

const createAsset = async (relativePath: string, contents: string): Promise<void> => {
  const dir = runDir(testRunId);
  runDirs.push(dir);
  const absolute = path.join(dir, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, contents, 'utf8');
};

describe('run assets', () => {
  afterEach(async () => {
    await Promise.all(runDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('reads generated assets below the run asset directory', async () => {
    await createAsset('assets/design-1.png', 'png-bytes');

    await expect(readRunAsset(testRunId, 'assets/design-1.png')).resolves.toMatchObject({
      bytes: Buffer.from('png-bytes'),
      contentType: 'image/png',
    });
  });

  it('rejects asset paths outside the run asset directory', async () => {
    await createAsset('assets/design-1.png', 'png-bytes');

    await expect(readRunAsset(testRunId, '../run.json')).rejects.toThrow('A valid run asset path is required.');
    await expect(readRunAsset(testRunId, 'assets/../../run.json')).rejects.toThrow('A valid run asset path is required.');
    await expect(readRunAsset(testRunId, '/etc/passwd')).rejects.toThrow('A valid run asset path is required.');
  });

  it('rejects invalid run ids before building filesystem paths', async () => {
    await expect(readRunAsset('x', 'assets/design-1.png')).rejects.toThrow('A valid run id is required.');
    await expect(readRunAsset('../../../../etc', 'assets/design-1.png')).rejects.toThrow('A valid run id is required.');
  });
});
