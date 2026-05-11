import type { DesignOutput, DesignRun } from '../shared/types.js';
import { resolveDesignAssetPath } from '../shared/designImageRevision.js';
import { readRunAsset } from './assets.js';

export const runDesignDataUrl = async (
  run: DesignRun,
  design: DesignOutput,
): Promise<string> => {
  const asset = await readRunAsset(run.id, resolveDesignAssetPath(design));
  return `data:${asset.contentType};base64,${asset.bytes.toString('base64')}`;
};
