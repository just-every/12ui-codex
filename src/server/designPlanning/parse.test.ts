import { describe, expect, it } from 'vitest';
import { parseDesignIdeas, parseIndividualDesignPrompt } from './parse.js';

describe('design planning parsers', () => {
  it('parses the exact requested idea count', () => {
    expect(parseDesignIdeas(JSON.stringify({
      ideas: [
        {
          title: 'Coffee Checkout',
          direction: 'Plain checkout implementation',
          creativeDistance: 0,
          intent: 'Make the requested checkout screen directly.',
        },
        {
          title: 'Cafe Counter Checkout',
          direction: 'A more spatial point-of-sale-inspired flow',
          creativeDistance: 1,
          intent: 'Push the checkout toward an in-store counter metaphor.',
        },
      ],
    }), 2)).toEqual([
      {
        branchIndex: 1,
        title: 'Coffee Checkout',
        direction: 'Plain checkout implementation',
        creativeDistance: 0,
        intent: 'Make the requested checkout screen directly.',
      },
      {
        branchIndex: 2,
        title: 'Cafe Counter Checkout',
        direction: 'A more spatial point-of-sale-inspired flow',
        creativeDistance: 1,
        intent: 'Push the checkout toward an in-store counter metaphor.',
      },
    ]);
  });

  it('rejects the wrong idea count', () => {
    expect(() => parseDesignIdeas(JSON.stringify({ ideas: [] }), 3))
      .toThrow('Idea planner returned 0 ideas; expected 3.');
  });

  it('surfaces malformed planner JSON', () => {
    expect(() => parseDesignIdeas('{nope', 1)).toThrow();
  });

  it('rejects empty individual design prompts', () => {
    expect(() => parseIndividualDesignPrompt(JSON.stringify({
      title: 'Dashboard',
      interpretation: 'A direct dashboard.',
      prompt: '   ',
    }), 1)).toThrow('Design prompt 1 is missing prompt.');
  });

  it('parses an individual design prompt', () => {
    expect(parseIndividualDesignPrompt(JSON.stringify({
      title: 'Dashboard',
      interpretation: 'A direct dashboard.',
      prompt: 'Full-screen dashboard interface.',
    }), 1)).toEqual({
      branchIndex: 1,
      title: 'Dashboard',
      interpretation: 'A direct dashboard.',
      prompt: 'Full-screen dashboard interface.',
    });
  });
});
