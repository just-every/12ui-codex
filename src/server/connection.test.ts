import { describe, expect, it, vi } from 'vitest';
import { checkConnection, getConnection, getTwelveUiOrigin } from './connection.js';

describe('connection', () => {
  it('normalizes and stores a healthy local UI origin', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: 'ok',
      workerOrigin: 'http://127.0.0.1:9918',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const connection = await checkConnection('http://127.0.0.1:9918/app?x=1', fetchImpl as unknown as typeof fetch);

    expect(connection.status).toBe('ok');
    expect(connection.origin).toBe('http://127.0.0.1:9918');
    expect(getConnection().origin).toBe('http://127.0.0.1:9918');
    expect(getTwelveUiOrigin()).toBe('http://127.0.0.1:9918');
    const firstCall = fetchImpl.mock.calls[0] as unknown[] | undefined;
    expect(String(firstCall?.[0])).toBe('http://127.0.0.1:9918/api/status');
  });

  it('records connection failures without falling back to another origin', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));

    const connection = await checkConnection('http://127.0.0.1:9988', fetchImpl as unknown as typeof fetch);

    expect(connection.status).toBe('error');
    expect(connection.origin).toBe('http://127.0.0.1:9988');
    expect(connection.message).toContain('503');
    expect(getTwelveUiOrigin()).toBe('http://127.0.0.1:9988');
  });
});
