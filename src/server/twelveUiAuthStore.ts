import { existsSync, readFileSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { dataRoot, isLocalTwelveUiMode, serverConfig } from './config.js';

export type TwelveUiStoredAuth = {
  origin: string;
  apiKey: string;
  clientId: string;
  organizationId: string;
  organizationName?: string | null;
  organizationSlug?: string | null;
  createdAt: string;
};

export type TwelveUiAuthStatus = {
  configured: boolean;
  source: 'env' | 'file' | 'local' | null;
  organizationId?: string | null;
  organizationName?: string | null;
  clientId?: string | null;
};

export const authFilePath = path.join(dataRoot, 'auth.json');

const parseStoredAuth = (raw: unknown): TwelveUiStoredAuth | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : '';
  const clientId = typeof record.clientId === 'string' ? record.clientId.trim() : '';
  const organizationId = typeof record.organizationId === 'string' ? record.organizationId.trim() : '';
  const origin = typeof record.origin === 'string' ? record.origin.trim() : serverConfig.twelveUiOrigin;
  if (!apiKey || !clientId || !organizationId) return null;
  return {
    origin,
    apiKey,
    clientId,
    organizationId,
    organizationName: typeof record.organizationName === 'string' ? record.organizationName : null,
    organizationSlug: typeof record.organizationSlug === 'string' ? record.organizationSlug : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  };
};

export const readStoredTwelveUiAuth = (): TwelveUiStoredAuth | null => {
  if (!existsSync(authFilePath)) return null;
  try {
    return parseStoredAuth(JSON.parse(readFileSync(authFilePath, 'utf8')));
  } catch {
    return null;
  }
};

export const getTwelveUiApiKey = (): string => {
  const envKey = serverConfig.twelveUiApiKey.trim();
  if (envKey) return envKey;
  return readStoredTwelveUiAuth()?.apiKey ?? '';
};

export const getTwelveUiAuthStatus = (): TwelveUiAuthStatus => {
  if (serverConfig.twelveUiApiKey.trim()) {
    return { configured: true, source: 'env' };
  }
  if (isLocalTwelveUiMode()) {
    return {
      configured: true,
      source: 'local',
      organizationName: 'Local 12ui',
    };
  }
  const stored = readStoredTwelveUiAuth();
  if (!stored) return { configured: false, source: null };
  return {
    configured: true,
    source: 'file',
    organizationId: stored.organizationId,
    organizationName: stored.organizationName ?? null,
    clientId: stored.clientId,
  };
};

export const writeStoredTwelveUiAuth = async (auth: TwelveUiStoredAuth): Promise<void> => {
  await mkdir(path.dirname(authFilePath), { recursive: true });
  await writeFile(authFilePath, `${JSON.stringify(auth, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
};

export const clearStoredTwelveUiAuth = async (): Promise<void> => {
  try {
    await unlink(authFilePath);
  } catch {
    // Already disconnected.
  }
};
