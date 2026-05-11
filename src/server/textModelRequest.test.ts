import { describe, expect, it, vi } from 'vitest';

const ensembleRequest = vi.fn((_messages, agent) => ({ agent }));
const ensembleResult = vi.fn();

vi.mock('@just-every/ensemble', () => ({
  ensembleRequest,
  ensembleResult,
}));

describe('text model request fallback', () => {
  it('tries the configured fallback model when the primary text model fails', async () => {
    const { requestTextModelWithFallback } = await import('./textModelRequest.js');
    ensembleResult.mockImplementation(async (request: { agent: { model: string } }) => (
      request.agent.model === 'codex-gpt-5.3-codex-spark'
        ? { error: 'primary unavailable', message: '' }
        : { error: null, message: '{"ok":true}' }
    ));

    const result = await requestTextModelWithFallback({
      agent: { agent_id: 'test-agent' },
      label: 'Test planning',
      messages: [],
      parse: (message) => JSON.parse(message) as { ok: boolean },
    });

    expect(result).toEqual({ ok: true });
    expect(ensembleRequest.mock.calls.map((call) => call[1].model)).toEqual([
      'codex-gpt-5.3-codex-spark',
      'codex-gpt-5.5-low',
    ]);
  });
});
