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

const resolveDataRoot = (): string => {
  const configured = process.env.CODEX_12UI_DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(homedir(), '.12ui', 'codex-design');
};

export const dataRoot = resolveDataRoot();
export const runsRoot = path.join(dataRoot, 'runs');
export const serverStateRoot = path.join(dataRoot, 'server');

export const LOCAL_TWELVE_UI_ORIGIN = 'http://127.0.0.1:9918';
const DEFAULT_TEXT_MODEL = 'codex-gpt-5.3-codex-spark';
const DEFAULT_TEXT_FALLBACK_MODEL = 'codex-gpt-5.5-low';
const DEFAULT_IMAGE_PROMPT_MODEL = DEFAULT_TEXT_FALLBACK_MODEL;
const splitModelList = (value: string | undefined): string[] => (
  (value ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0)
);

const isProductionRuntime = (): boolean => process.env.NODE_ENV === 'production';

const resolveTwelveUiOrigin = (): string => (
  process.env.TWELVE_UI_ORIGIN?.trim()
    || (isProductionRuntime() ? 'https://12ui.com' : LOCAL_TWELVE_UI_ORIGIN)
);

export const isLocalTwelveUiOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1';
  } catch {
    return false;
  }
};

export const serverConfig = {
  host: process.env.CODEX_12UI_HOST?.trim() || '127.0.0.1',
  port: Number(process.env.CODEX_12UI_PORT || 9971),
  textModel: process.env.CODEX_12UI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL,
  textFallbackModel: process.env.CODEX_12UI_TEXT_FALLBACK_MODEL?.trim() || DEFAULT_TEXT_FALLBACK_MODEL,
  imageModel: process.env.CODEX_12UI_IMAGE_MODEL?.trim() || 'codex-gpt-image-2',
  imagePromptModel: process.env.CODEX_12UI_IMAGE_PROMPT_MODEL?.trim() || DEFAULT_IMAGE_PROMPT_MODEL,
  imagePromptFallbackModels: splitModelList(process.env.CODEX_12UI_IMAGE_PROMPT_FALLBACK_MODELS).length > 0
    ? splitModelList(process.env.CODEX_12UI_IMAGE_PROMPT_FALLBACK_MODELS)
    : [DEFAULT_TEXT_FALLBACK_MODEL],
  codexHome: process.env.CODEX_HOME?.trim() || path.join(homedir(), '.codex'),
  twelveUiOrigin: resolveTwelveUiOrigin(),
  twelveUiApiKey: process.env.TWELVE_UI_API_KEY?.trim() || '',
};

export const isLocalTwelveUiMode = (): boolean => (
  !isProductionRuntime()
  && !serverConfig.twelveUiApiKey
  && isLocalTwelveUiOrigin(serverConfig.twelveUiOrigin)
);
