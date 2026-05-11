import { describe, expect, it } from 'vitest';
import { extractHandoverLinks } from './twelveUi.js';

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
});
