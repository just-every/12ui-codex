import { describe, expect, it } from 'vitest';
import { parseDesignIdeas, parseIndividualDesignPrompt } from './parse.js';

describe('design planning parsers', () => {
  it('parses the exact requested idea count', () => {
    expect(parseDesignIdeas(JSON.stringify({
      ideas: [
        {
          name: 'Coffee Checkout',
          direction: 'Plain checkout implementation',
          description: 'A direct checkout screen with familiar product, cart, and payment components.',
          header: 'Compact coffee shop brand bar with utility actions.',
          primaryCta: 'Clear pay now button anchored near the order total.',
          supportingUi: 'Order summary cards, payment form fields, and status chips.',
          imagery: 'Small product photography and coffee texture accents.',
          tone: 'Warm, efficient, and trustworthy.',
          differentFromPrevious: 'Baseline branch: the straightforward checkout interpretation.',
          avoidOverlapWithOtherBranches: 'Avoid theatrical counter metaphors or editorial membership framing.',
          creativeDistance: 0,
          intent: 'Make the requested checkout screen directly.',
        },
        {
          name: 'Cafe Counter Checkout',
          direction: 'A more spatial point-of-sale-inspired flow',
          description: 'A counter-service checkout that feels like ordering from a premium cafe.',
          header: 'Menu-board inspired header with queue and pickup status.',
          primaryCta: 'Large confirmation action styled like a receipt stamp.',
          supportingUi: 'Tabbed item groups, loyalty module, and pickup details.',
          imagery: 'Barista counter imagery and subtle receipt-like graphic details.',
          tone: 'Tactile, hospitable, and lively.',
          differentFromPrevious: 'Moves away from a plain checkout into a spatial cafe counter flow.',
          avoidOverlapWithOtherBranches: 'Avoid standard payment-form dominance and avoid subscription editorial framing.',
          creativeDistance: 1,
          intent: 'Push the checkout toward an in-store counter metaphor.',
        },
      ],
    }), 2)).toEqual([
      {
        branchIndex: 1,
        name: 'Coffee Checkout',
        direction: 'Plain checkout implementation',
        description: 'A direct checkout screen with familiar product, cart, and payment components.',
        header: 'Compact coffee shop brand bar with utility actions.',
        primaryCta: 'Clear pay now button anchored near the order total.',
        supportingUi: 'Order summary cards, payment form fields, and status chips.',
        imagery: 'Small product photography and coffee texture accents.',
        tone: 'Warm, efficient, and trustworthy.',
        differentFromPrevious: 'Baseline branch: the straightforward checkout interpretation.',
        avoidOverlapWithOtherBranches: 'Avoid theatrical counter metaphors or editorial membership framing.',
        creativeDistance: 0,
        intent: 'Make the requested checkout screen directly.',
      },
      {
        branchIndex: 2,
        name: 'Cafe Counter Checkout',
        direction: 'A more spatial point-of-sale-inspired flow',
        description: 'A counter-service checkout that feels like ordering from a premium cafe.',
        header: 'Menu-board inspired header with queue and pickup status.',
        primaryCta: 'Large confirmation action styled like a receipt stamp.',
        supportingUi: 'Tabbed item groups, loyalty module, and pickup details.',
        imagery: 'Barista counter imagery and subtle receipt-like graphic details.',
        tone: 'Tactile, hospitable, and lively.',
        differentFromPrevious: 'Moves away from a plain checkout into a spatial cafe counter flow.',
        avoidOverlapWithOtherBranches: 'Avoid standard payment-form dominance and avoid subscription editorial framing.',
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
      directionFidelity: 'Preserves the direct dashboard direction.',
      visualDifferentiators: ['compact controls', 'clear status panels'],
      prompt: '   ',
    }), 1)).toThrow('Design prompt 1 is missing prompt.');
  });

  it('parses an individual design prompt', () => {
    expect(parseIndividualDesignPrompt(JSON.stringify({
      title: 'Dashboard',
      interpretation: 'A direct dashboard.',
      directionFidelity: 'Preserves the assigned dashboard direction and keeps its compact control language.',
      visualDifferentiators: ['compact controls', 'clear status panels'],
      prompt: 'Full-screen dashboard interface.',
    }), 1)).toEqual({
      branchIndex: 1,
      title: 'Dashboard',
      interpretation: 'A direct dashboard.',
      directionFidelity: 'Preserves the assigned dashboard direction and keeps its compact control language.',
      visualDifferentiators: ['compact controls', 'clear status panels'],
      prompt: 'Full-screen dashboard interface.',
    });
  });
});
