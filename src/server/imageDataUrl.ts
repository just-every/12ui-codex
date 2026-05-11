import type { DesignOutput, DesignRun } from '../shared/types.js';
import { readRunAsset } from './assets.js';

export const runDesignDataUrl = async (
  run: DesignRun,
  design: DesignOutput,
): Promise<string> => {
  const asset = await readRunAsset(run.id, design.assetPath);
  return `data:${asset.contentType};base64,${asset.bytes.toString('base64')}`;
};
