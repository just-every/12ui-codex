import { describe, expect, it } from 'vitest';
import { launchServerEnv } from './launchEnv.js';

describe('launchServerEnv', () => {
  it('launches compiled package servers in production mode', () => {
    expect(launchServerEnv('/pkg/dist/server/server/index.js', {}, '127.0.0.1', 9971)).toMatchObject({
      CODEX_12UI_HOST: '127.0.0.1',
      CODEX_12UI_PORT: '9971',
      NODE_ENV: 'production',
    });
  });

  it('does not force production mode for source TypeScript dev launches', () => {
    expect(launchServerEnv('/repo/src/server/index.ts', {}, '127.0.0.1', 9972)).toEqual({
      CODEX_12UI_HOST: '127.0.0.1',
      CODEX_12UI_PORT: '9972',
    });
  });
});
