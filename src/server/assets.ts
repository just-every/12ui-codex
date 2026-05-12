import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runDir } from './runStore.js';

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/i;

export type BinaryImage = {
  bytes: Buffer;
  contentType: string;
  extension: 'png' | 'jpg' | 'webp';
};

const extensionForContentType = (contentType: string): BinaryImage['extension'] => {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
};

export const decodeImageData = async (value: string): Promise<BinaryImage> => {
  const dataUrlMatch = DATA_URL_PATTERN.exec(value.trim());
  if (dataUrlMatch) {
    const contentType = dataUrlMatch[1].toLowerCase();
    return {
      bytes: Buffer.from(dataUrlMatch[2], 'base64'),
      contentType,
      extension: extensionForContentType(contentType),
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Image download failed with ${response.status}.`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType,
      extension: extensionForContentType(contentType),
    };
  }

  const cleaned = value.trim().replace(/\s+/g, '');
  if (!cleaned) throw new Error('Generated image response was empty.');
  return {
    bytes: Buffer.from(cleaned, 'base64'),
    contentType: 'image/png',
    extension: 'png',
  };
};

export const saveImageData = async (
  runId: string,
  fileStem: string,
  value: string,
): Promise<{ assetPath: string; contentType: string; bytes: Buffer }> => {
  const image = await decodeImageData(value);
  const relativePath = `assets/${fileStem}.${image.extension}`;
  const absolutePath = path.join(runDir(runId), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, image.bytes);
  return {
    assetPath: relativePath,
    contentType: image.contentType,
    bytes: image.bytes,
  };
};

const resolveRunAssetPath = (runId: string, assetPath: string): { absolute: string; relative: string } => {
  const relative = assetPath.trim().replace(/^assets[\\/]+/, '');
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  if (
    !relative
    || path.isAbsolute(relative)
    || path.win32.isAbsolute(relative)
    || segments.some((segment) => segment === '..' || segment === '.')
  ) {
    throw new Error('A valid run asset path is required.');
  }

  const assetRoot = path.resolve(runDir(runId), 'assets');
  const absolute = path.resolve(assetRoot, ...segments);
  const assetRootWithSeparator = `${assetRoot}${path.sep}`;
  if (absolute !== assetRoot && !absolute.startsWith(assetRootWithSeparator)) {
    throw new Error('A valid run asset path is required.');
  }

  return { absolute, relative: segments.join('/') };
};

export const readRunAsset = async (
  runId: string,
  assetPath: string,
): Promise<{ bytes: Buffer; contentType: string }> => {
  const { absolute, relative } = resolveRunAssetPath(runId, assetPath);
  const bytes = await readFile(absolute);
  const extension = path.extname(relative).toLowerCase();
  const contentType = extension === '.jpg' || extension === '.jpeg'
    ? 'image/jpeg'
    : extension === '.webp'
      ? 'image/webp'
      : 'image/png';
  return { bytes, contentType };
};
