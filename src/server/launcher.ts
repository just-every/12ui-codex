import { spawn } from 'node:child_process';
import { access, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, serverConfig } from './config.js';
import { getStatus } from './cliHttp.js';
import { chooseLaunchPort, originForPort, readRememberedPort, rememberPort } from './serverPort.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const serverEntryPath = (): string => {
  if (here.endsWith(path.join('src', 'server'))) return path.join(here, 'index.ts');
  return path.join(here, 'index.js');
};

const commandForEntry = (entry: string): { command: string; args: string[] } => (
  entry.endsWith('.ts')
    ? { command: 'tsx', args: [entry] }
    : { command: process.execPath, args: [entry] }
);

export const launchServer = async (): Promise<{
  origin: string;
  status: 'already_running' | 'started';
  pid?: number;
  port: number;
}> => {
  const rememberedPort = readRememberedPort();
  if (rememberedPort) {
    const rememberedOrigin = originForPort(rememberedPort);
    try {
      await getStatus(rememberedOrigin);
      return { origin: rememberedOrigin, status: 'already_running', port: rememberedPort };
    } catch {
      // Remembered server is not alive; choose a free port below.
    }
  }

  const port = await chooseLaunchPort();
  const origin = originForPort(port);
  try {
    await getStatus(origin);
    await rememberPort(port);
    return { origin, status: 'already_running', port };
  } catch {
    const entry = serverEntryPath();
    await access(entry);
    const logsDir = path.join(projectRoot, '.runs', 'codex-design-server');
    await mkdir(logsDir, { recursive: true });
    const out = await open(path.join(logsDir, 'server.log'), 'a');
    const err = await open(path.join(logsDir, 'server-error.log'), 'a');
    const { command, args } = commandForEntry(entry);
    const child = spawn(command, args, {
      cwd: projectRoot,
      detached: true,
      env: {
        ...process.env,
        CODEX_12UI_HOST: serverConfig.host,
        CODEX_12UI_PORT: String(port),
      },
      stdio: ['ignore', out.fd, err.fd],
    });
    child.unref();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        await getStatus(origin);
        await rememberPort(port);
        return { origin, status: 'started', pid: child.pid, port };
      } catch {
        continue;
      }
    }
    throw new Error(`Started server process ${child.pid ?? '(unknown pid)'} but ${origin} did not become ready within 20s.`);
  }
};
