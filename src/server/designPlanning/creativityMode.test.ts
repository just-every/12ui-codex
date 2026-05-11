import { describe, expect, it, vi } from 'vitest';
import type { CreateRunRequest } from '../../shared/types.js';
import { planDesignIdeas } from './ideaPlanner.js';
import { planIndividualDesignPrompt } from './individualDesignPlanner.js';

const mocks = vi.hoisted(() => ({
  requestTextModelWithFallback: vi.fn(),
}));

vi.mock('../textModelRequest.js', () => ({
  requestTextModelWithFallback: mocks.requestTextModelWithFallback,
}));

const request: CreateRunRequest = {
  prompt: 'Create a personal finance dashboard.',
  sketchDataUrl: null,
  referenceDataUrls: [],
  batchSize: 3,
  aspect: 'portrait',
  quality: 'medium',
  creativityMode: 'creative',
};

const firstUserText = (): string => {
  const call = mocks.requestTextModelWithFallback.mock.calls.at(-1)?.[0] as {
    messages?: Array<{ content?: Array<{ text?: string }> }>;
  } | undefined;
  return call?.messages?.[0]?.content?.find((item) => typeof item.text === 'string')?.text ?? '';
};

describe('design planning creativity mode', () => {
  it('pushes Creative mode into idea planning instructions', async () => {
    mocks.requestTextModelWithFallback.mockImplementationOnce(async (args: { parse: (message: string) => unknown }) => args.parse(JSON.stringify({
      ideas: [
        {
          name: 'Finance Dashboard',
          direction: 'Art-directed anchor dashboard.',
          description: 'A legible but editorial finance workspace.',
          header: 'Compact market-watch header.',
          primaryCta: 'Investment action as a broker ticket.',
          supportingUi: 'Dense cashflow console and goal cards.',
          imagery: 'Abstract wealth-map graphics.',
          tone: 'Confident and exploratory.',
          differentFromPrevious: 'Baseline branch with an art-directed anchor.',
          avoidOverlapWithOtherBranches: 'Avoid standard SaaS cards and generic charts.',
          creativeDistance: 4,
          intent: 'Establish the clearest Creative anchor.',
        },
        {
          name: 'Financial Observatory',
          direction: 'Cinematic observatory control room.',
          description: 'A celestial market navigation surface.',
          header: 'Telescope-style navigation rail.',
          primaryCta: 'Orbit-adjustment command.',
          supportingUi: 'Planetary account panels and risk constellations.',
          imagery: 'Orbital diagrams and luminous ledgers.',
          tone: 'Speculative and precise.',
          differentFromPrevious: 'Jumps from dashboard anchor to spatial observatory metaphor.',
          avoidOverlapWithOtherBranches: 'Avoid plain account cards and conventional charts.',
          creativeDistance: 8,
          intent: 'Make the finance brief feel genuinely inspirational.',
        },
        {
          name: 'Cashflow Atelier',
          direction: 'Editorial studio for sculpting money flows.',
          description: 'A tactile financial atelier with tool palettes.',
          header: 'Studio inventory header.',
          primaryCta: 'Shape next budget move.',
          supportingUi: 'Canvas-like flow controls and artifact trays.',
          imagery: 'Paper, ink, and dimensional finance objects.',
          tone: 'Inventive and hands-on.',
          differentFromPrevious: 'Moves from cinematic observatory to tactile studio composition.',
          avoidOverlapWithOtherBranches: 'Avoid orbital graphics and normal dashboard grids.',
          creativeDistance: 9,
          intent: 'Offer a far alternate creative interpretation.',
        },
      ],
    })));

    await planDesignIdeas(request);

    expect(firstUserText()).toContain('Creativity mode: Creative.');
    expect(firstUserText()).toContain('visually distinctive, art-directed interface concepts');
    expect(firstUserText()).toContain('Do not make creativity mean more panels');
    expect(firstUserText()).toContain('one clear visual thesis');
  });

  it('tells individual prompt synthesis to favor minimal visual creativity over density', async () => {
    mocks.requestTextModelWithFallback.mockImplementationOnce(async (args: { parse: (message: string) => unknown }) => args.parse(JSON.stringify({
      title: 'Financial Observatory',
      interpretation: 'Turns the finance dashboard into a spatial observatory.',
      directionFidelity: 'Keeps the observatory metaphor, luminous ledgers, and orbital controls.',
      visualDifferentiators: ['telescope navigation rail', 'planetary account panels'],
      prompt: 'A full-screen financial observatory interface with orbital controls.',
    })));

    await planIndividualDesignPrompt(request, {
      branchIndex: 2,
      name: 'Financial Observatory',
      direction: 'Cinematic observatory control room.',
      description: 'A celestial market navigation surface.',
      header: 'Telescope-style navigation rail.',
      primaryCta: 'Orbit-adjustment command.',
      supportingUi: 'Planetary account panels and risk constellations.',
      imagery: 'Orbital diagrams and luminous ledgers.',
      tone: 'Speculative and precise.',
      differentFromPrevious: 'Jumps from dashboard anchor to spatial observatory metaphor.',
      avoidOverlapWithOtherBranches: 'Avoid plain account cards and conventional charts.',
      creativeDistance: 8,
      intent: 'Make the finance brief feel genuinely inspirational.',
    });

    expect(firstUserText()).toContain('Creativity mode: Creative.');
    expect(firstUserText()).toContain('do not translate creativity into a busier interface');
    expect(firstUserText()).toContain('Bias toward minimalism unless the user specifically requested');
    expect(firstUserText()).toContain('visible art direction, not extra UI density');
  });
});
