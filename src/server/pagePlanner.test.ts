import { describe, expect, it } from 'vitest';

import { parsePagePlan } from './pagePlanner.js';

describe('parsePagePlan', () => {
  it('parses page plan output without adding fallback pages', () => {
    expect(parsePagePlan(JSON.stringify({
      pages: [
        { title: 'Pricing', prompt: 'Generate the pricing page for the same site.' },
        { title: 'Docs API', prompt: 'Generate a combined Docs/API page for the same site.' },
      ],
    }))).toEqual([
      {
        id: 'pricing-1',
        order: 1,
        title: 'Pricing',
        prompt: 'Generate the pricing page for the same site.',
      },
      {
        id: 'docs-api-2',
        order: 2,
        title: 'Docs API',
        prompt: 'Generate a combined Docs/API page for the same site.',
      },
    ]);
  });

  it('rejects malformed or empty planner output', () => {
    expect(() => parsePagePlan(JSON.stringify({ pages: [] }))).toThrow(
      'Planner returned 0 pages; expected 1-8.',
    );
    expect(() => parsePagePlan(JSON.stringify({ pages: [{ title: 'Pricing', prompt: '' }] }))).toThrow(
      'Planner page 1 is missing a title or prompt.',
    );
  });
});
