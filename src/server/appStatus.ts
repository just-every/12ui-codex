import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppStatus } from '../shared/types.js';

const execFile = promisify(execFileCallback);

const nowIso = (): string => new Date().toISOString();

export const getAppStatus = async (): Promise<AppStatus> => {
  const checkedAt = nowIso();
  try {
    const { stdout, stderr } = await execFile('codex', ['--version'], { timeout: 2500 });
    const version = (stdout || stderr).trim() || null;
    return {
      status: 'ok',
      checkedAt,
      node: {
        status: 'ok',
        message: 'Node server is running.',
      },
      codex: {
        installed: true,
        version,
        error: null,
      },
      message: version ? `Codex installed: ${version}` : 'Codex is installed.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Codex CLI check failed.';
    return {
      status: 'error',
      checkedAt,
      node: {
        status: 'ok',
        message: 'Node server is running.',
      },
      codex: {
        installed: false,
        version: null,
        error: message,
      },
      message: 'Codex CLI is not installed or is not available on PATH.',
    };
  }
};
