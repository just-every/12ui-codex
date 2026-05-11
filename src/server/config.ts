import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

const resolveProjectRoot = (): string => {
  const sourceRoot = path.resolve(here, '../..');
  if (existsSync(path.join(sourceRoot, 'package.json'))) return sourceRoot;
  return path.resolve(here, '../../..');
};

export const projectRoot = resolveProjectRoot();
export const runsRoot = path.join(projectRoot, '.runs');

export const serverConfig = {
  host: process.env.CODEX_12UI_HOST?.trim() || '127.0.0.1',
  port: Number(process.env.CODEX_12UI_PORT || 9971),
  textModel: process.env.CODEX_12UI_TEXT_MODEL?.trim() || 'codex-gpt-5.5-high',
  imageModel: process.env.CODEX_12UI_IMAGE_MODEL?.trim() || 'codex-gpt-image-2',
  codexHome: process.env.CODEX_HOME?.trim() || path.join(homedir(), '.codex'),
  twelveUiOrigin: process.env.TWELVE_UI_ORIGIN?.trim() || 'https://12ui.com',
  twelveUiApiKey: process.env.TWELVE_UI_API_KEY?.trim() || '',
};
