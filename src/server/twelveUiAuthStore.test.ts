import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDataDir = process.env.CODEX_12UI_DATA_DIR;
const originalApiKey = process.env.TWELVE_UI_API_KEY;
const originalOrigin = process.env.TWELVE_UI_ORIGIN;

const loadWithDataDir = async () => {
  vi.resetModules();
  const dataDir = await mkdtemp(path.join(tmpdir(), '12ui-auth-store-'));
  process.env.CODEX_12UI_DATA_DIR = dataDir;
  delete process.env.TWELVE_UI_API_KEY;
  return import('./twelveUiAuthStore.js');
};

afterEach(() => {
  vi.resetModules();
  if (originalDataDir === undefined) delete process.env.CODEX_12UI_DATA_DIR;
  else process.env.CODEX_12UI_DATA_DIR = originalDataDir;
  if (originalApiKey === undefined) delete process.env.TWELVE_UI_API_KEY;
  else process.env.TWELVE_UI_API_KEY = originalApiKey;
  if (originalOrigin === undefined) delete process.env.TWELVE_UI_ORIGIN;
  else process.env.TWELVE_UI_ORIGIN = originalOrigin;
});

describe('twelveUiAuthStore', () => {
  it('returns an environment API key only for the configured 12ui origin', async () => {
    vi.resetModules();
    process.env.TWELVE_UI_API_KEY = 'ENV_12UI_KEY';
    process.env.TWELVE_UI_ORIGIN = 'https://configured.12ui.example';

    const authStore = await import('./twelveUiAuthStore.js');

    expect(authStore.getTwelveUiApiKey('https://configured.12ui.example/app')).toBe('ENV_12UI_KEY');
    expect(authStore.getTwelveUiApiKey('https://attacker.example')).toBe('');
  });

  it('returns a stored API key only for the origin it was issued for', async () => {
    const authStore = await loadWithDataDir();
    await authStore.writeStoredTwelveUiAuth({
      origin: 'https://legit.12ui.example/app?ignored=1',
      apiKey: 'SECRET_STORED_12UI_KEY',
      clientId: 'client-1',
      organizationId: 'org-1',
      createdAt: '2026-05-11T00:00:00.000Z',
    });

    expect(authStore.getTwelveUiApiKey('https://legit.12ui.example/other')).toBe('SECRET_STORED_12UI_KEY');
    expect(authStore.getTwelveUiApiKey('https://attacker.example')).toBe('');
  });

  it('stops handover before reading assets or posting when stored auth belongs to another origin', async () => {
    vi.resetModules();
    const dataDir = await mkdtemp(path.join(tmpdir(), '12ui-handover-auth-'));
    process.env.CODEX_12UI_DATA_DIR = dataDir;
    process.env.TWELVE_UI_ORIGIN = 'https://attacker.example';
    delete process.env.TWELVE_UI_API_KEY;

    const authStore = await import('./twelveUiAuthStore.js');
    await authStore.writeStoredTwelveUiAuth({
      origin: 'https://legit.12ui.example',
      apiKey: 'SECRET_STORED_12UI_KEY',
      clientId: 'client-1',
      organizationId: 'org-1',
      createdAt: '2026-05-11T00:00:00.000Z',
    });
    const { submitTwelveUiHandover } = await import('./twelveUi.js');
    const fetchImpl = vi.fn();

    await expect(submitTwelveUiHandover({
      runId: 'missing-run',
      designId: 'design-1',
      assetPath: 'design.png',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow('Stored 12ui authentication is bound to https://legit.12ui.example');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
