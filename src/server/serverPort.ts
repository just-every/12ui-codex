import net from 'node:net';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { projectRoot, serverConfig } from './config.js';

const DEFAULT_PORT = 9971;
const DEFAULT_RANGE_END = 9999;

const stateDir = path.join(projectRoot, '.runs', 'codex-design-server');
const statePath = path.join(stateDir, 'server.json');

const parsePort = (value: unknown): number | null => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
};

const configuredPort = (): number | null => parsePort(process.env.CODEX_12UI_PORT);

const range = (): { start: number; end: number } => {
  const raw = process.env.CODEX_12UI_PORT_RANGE?.trim() ?? '';
  const match = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return { start: DEFAULT_PORT, end: DEFAULT_RANGE_END };
  const start = parsePort(match[1]) ?? DEFAULT_PORT;
  const end = parsePort(match[2]) ?? DEFAULT_RANGE_END;
  return start <= end ? { start, end } : { start: end, end: start };
};

export const originForPort = (port: number): string => `http://${serverConfig.host}:${port}`;

export const readRememberedPort = (): number | null => {
  if (!existsSync(statePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as { port?: unknown };
    return parsePort(parsed.port);
  } catch {
    return null;
  }
};

export const rememberPort = async (port: number): Promise<void> => {
  await mkdir(stateDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify({ port, origin: originForPort(port), updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
};

export const resolveCliPort = (): number => configuredPort() ?? readRememberedPort() ?? DEFAULT_PORT;

export const isPortFree = async (port: number): Promise<boolean> => new Promise((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.once('listening', () => {
    server.close(() => resolve(true));
  });
  server.listen(port, serverConfig.host);
});

export const chooseLaunchPort = async (): Promise<number> => {
  const explicit = parsePort(process.env.CODEX_12UI_PORT);
  if (explicit) return explicit;
  const remembered = readRememberedPort();
  if (remembered && await isPortFree(remembered)) return remembered;
  const { start, end } = range();
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in CODEX_12UI_PORT_RANGE ${start}-${end}.`);
};
