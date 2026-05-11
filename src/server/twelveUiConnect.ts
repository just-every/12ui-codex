import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { serverConfig } from './config.js';
import { writeStoredTwelveUiAuth } from './twelveUiAuthStore.js';

type PendingConnect = {
  id: string;
  createdAt: number;
  returnUrl: string;
};

const pending = new Map<string, PendingConnect>();
const PENDING_TTL_MS = 10 * 60 * 1000;

const loginOrigin = (): string => process.env.TWELVE_UI_LOGIN_ORIGIN?.trim() || 'https://login.justevery.com';

const requestOrigin = (request: IncomingMessage): string => {
  const host = request.headers.host || `${serverConfig.host}:${serverConfig.port}`;
  const proto = typeof request.headers['x-forwarded-proto'] === 'string'
    ? request.headers['x-forwarded-proto']
    : 'http';
  return `${proto}://${host}`;
};

const prunePending = (): void => {
  const now = Date.now();
  for (const [id, entry] of pending.entries()) {
    if (now - entry.createdAt > PENDING_TTL_MS) {
      pending.delete(id);
    }
  }
};

export const createTwelveUiConnectRequest = (request: IncomingMessage): { requestId: string; connectUrl: string; returnUrl: string } => {
  prunePending();
  const requestId = randomUUID();
  const returnUrl = new URL('/auth/12ui/callback', requestOrigin(request));
  returnUrl.searchParams.set('request', requestId);
  pending.set(requestId, {
    id: requestId,
    createdAt: Date.now(),
    returnUrl: returnUrl.toString(),
  });

  const connectUrl = new URL('/12ui/', loginOrigin());
  connectUrl.searchParams.set('request', requestId);
  connectUrl.searchParams.set('return', returnUrl.toString());
  connectUrl.searchParams.set('brand', '12ui');
  return {
    requestId,
    connectUrl: connectUrl.toString(),
    returnUrl: returnUrl.toString(),
  };
};

const consumePending = (requestId: string): PendingConnect => {
  prunePending();
  const entry = pending.get(requestId);
  if (!entry) throw new Error('Connection request expired. Start Connect 12ui again.');
  pending.delete(requestId);
  return entry;
};

export const finishTwelveUiConnect = async (args: {
  requestId: string;
  oneTimeToken: string;
  fetchImpl?: typeof fetch;
}): Promise<void> => {
  consumePending(args.requestId);
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(new URL('/api/auth/12ui/connect/exchange', loginOrigin()), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      oneTimeToken: args.oneTimeToken,
      request: args.requestId,
      name: '12ui Codex',
    }),
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = typeof body?.error === 'string' ? body.error : `Login exchange failed with ${response.status}.`;
    throw new Error(error);
  }
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!apiKey || !clientId || !organizationId) {
    throw new Error('Login exchange did not return a usable 12ui API key.');
  }
  await writeStoredTwelveUiAuth({
    origin: serverConfig.twelveUiOrigin,
    apiKey,
    clientId,
    organizationId,
    organizationName: typeof body?.organizationName === 'string' ? body.organizationName : null,
    organizationSlug: typeof body?.organizationSlug === 'string' ? body.organizationSlug : null,
    createdAt: new Date().toISOString(),
  });
};
