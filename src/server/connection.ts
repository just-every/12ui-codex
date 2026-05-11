import type { LocalUiConnection } from '../shared/types.js';
import { serverConfig } from './config.js';

const DEFAULT_LOCAL_UI_ORIGIN = 'http://127.0.0.1:9918';

let currentOrigin = serverConfig.twelveUiOrigin || DEFAULT_LOCAL_UI_ORIGIN;
let lastConnection: LocalUiConnection = {
  origin: currentOrigin,
  status: 'unchecked',
  message: 'Connection has not been checked yet.',
  checkedAt: null,
};

const normalizeOrigin = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) throw new Error('Local UI origin is required.');
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Local UI origin must use http or https.');
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const getTwelveUiOrigin = (): string => currentOrigin;

export const getConnection = (): LocalUiConnection => lastConnection;

export const checkConnection = async (
  originInput: unknown = currentOrigin,
  fetchImpl: typeof fetch = fetch,
): Promise<LocalUiConnection> => {
  const origin = normalizeOrigin(originInput);
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(new URL('/api/status', origin), {
      headers: { accept: 'application/json' },
    });
    const details = await readResponseBody(response);
    if (!response.ok) {
      lastConnection = {
        origin,
        status: 'error',
        message: `Local UI status returned ${response.status}.`,
        checkedAt,
        details,
      };
      currentOrigin = origin;
      return lastConnection;
    }
    lastConnection = {
      origin,
      status: 'ok',
      message: 'Connected to local 12ui UI.',
      checkedAt,
      details,
    };
    currentOrigin = origin;
    return lastConnection;
  } catch (error) {
    lastConnection = {
      origin,
      status: 'error',
      message: error instanceof Error ? error.message : 'Local UI connection failed.',
      checkedAt,
    };
    currentOrigin = origin;
    return lastConnection;
  }
};
