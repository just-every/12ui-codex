import { describe, expect, it, vi } from 'vitest';
import { extractHandoverLinks, fetchHandoverAsset } from './twelveUi.js';

describe('extractHandoverLinks', () => {
  it('reads top-level convert API links', () => {
    expect(extractHandoverLinks({
      status: 'https://12ui.com/api/v1/convert/run-1',
      handover: 'https://12ui.com/api/v1/convert/run-1/handover.md',
      handoverHtml: 'https://12ui.com/api/v1/convert/run-1/handover.html',
      zip: 'https://12ui.com/api/v1/convert/run-1/handover.zip',
    })).toEqual({
      statusUrl: 'https://12ui.com/api/v1/convert/run-1',
      handoverUrl: 'https://12ui.com/api/v1/convert/run-1/handover.md',
      handoverHtmlUrl: 'https://12ui.com/api/v1/convert/run-1/handover.html',
      zipUrl: 'https://12ui.com/api/v1/convert/run-1/handover.zip',
    });
  });

  it('reads nested link records', () => {
    expect(extractHandoverLinks({
      links: {
        statusUrl: 'status-url',
        handoverUrl: 'handover-url',
        handoverHtmlUrl: 'html-url',
        zipUrl: 'zip-url',
      },
    })).toEqual({
      statusUrl: 'status-url',
      handoverUrl: 'handover-url',
      handoverHtmlUrl: 'html-url',
      zipUrl: 'zip-url',
    });
  });

  it('fetches remote handover assets through the recorded URLs', async () => {
    const fetchImpl = vi.fn(async () => new Response('handover markdown', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    }));

    const response = await fetchHandoverAsset({
      handover: {
        designId: 'design-1',
        runId: 'run-1',
        handoverUrl: 'https://12ui.com/api/v1/convert/run-1/handover.md',
        handoverHtmlUrl: 'https://12ui.com/api/v1/convert/run-1/handover.html',
        raw: { ok: true },
        createdAt: '2026-05-11T00:00:00.000Z',
      },
      asset: 'handover.md',
      fetchImpl,
    });

    expect(await response.text()).toBe('handover markdown');
    expect(fetchImpl.mock.calls[0]?.[0]).toEqual(new URL('https://12ui.com/api/v1/convert/run-1/handover.md'));
  });
});
