import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';

import { createTwelveUiConnectRequest } from './twelveUiConnect.js';

describe('twelveUiConnect', () => {
  it('creates a Login bridge URL with a local one-time callback', () => {
    const request = {
      headers: {
        host: '127.0.0.1:3847',
      },
    } as IncomingMessage;

    const started = createTwelveUiConnectRequest(request);
    const connectUrl = new URL(started.connectUrl);
    const returnUrl = new URL(started.returnUrl);

    expect(connectUrl.origin).toBe('https://login.justevery.com');
    expect(connectUrl.pathname).toBe('/12ui/');
    expect(connectUrl.searchParams.get('service')).toBeNull();
    expect(connectUrl.searchParams.get('request')).toBe(started.requestId);
    expect(connectUrl.searchParams.get('return')).toBe(started.returnUrl);
    expect(returnUrl.origin).toBe('http://127.0.0.1:3847');
    expect(returnUrl.pathname).toBe('/auth/12ui/callback');
    expect(returnUrl.searchParams.get('request')).toBe(started.requestId);
  });
});
