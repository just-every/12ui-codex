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

export const readRunAsset = async (
  runId: string,
  assetPath: string,
): Promise<{ bytes: Buffer; contentType: string }> => {
  const absolute = path.join(runDir(runId), assetPath);
  const bytes = await readFile(absolute);
  const extension = path.extname(assetPath).toLowerCase();
  const contentType = extension === '.jpg' || extension === '.jpeg'
    ? 'image/jpeg'
    : extension === '.webp'
      ? 'image/webp'
      : 'image/png';
  return { bytes, contentType };
};
