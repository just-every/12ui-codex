import type { ResponseJSONSchema } from '@just-every/ensemble';

export const ideaPlanSchema = (count: number): ResponseJSONSchema => ({
  type: 'json_schema',
  name: 'codex_12ui_design_idea_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ideas: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              description: 'A distinctive natural name for this design direction. The first name should identify the requested interface itself, not a generic planning label.',
            },
            direction: {
              type: 'string',
              description: 'The concise overall creative direction for this branch.',
            },
            description: {
              type: 'string',
              description: 'A concrete component-direction description that distinguishes this branch from the others.',
            },
            header: {
              type: 'string',
              description: 'How the header, navigation, or top-level page chrome should feel for this branch.',
            },
            primaryCta: {
              type: 'string',
              description: 'How the primary call-to-action or main action treatment should differ for this branch.',
            },
            supportingUi: {
              type: 'string',
              description: 'The supporting UI/component treatment. Keep it selective and hierarchy-led; do not add density just to make the branch feel different.',
            },
            imagery: {
              type: 'string',
              description: 'The branch-specific imagery, illustration, graphic, icon, media, or visual asset approach.',
            },
            tone: {
              type: 'string',
              description: 'The branch-specific mood and visual tone.',
            },
            differentFromPrevious: {
              type: 'string',
              description: 'How this branch is visually or structurally different from the previous branch. For the first branch, explain that it is the baseline straightforward interpretation.',
            },
            avoidOverlapWithOtherBranches: {
              type: 'string',
              description: 'Specific traits this branch should avoid sharing with other branches so the generated results do not collapse into near-duplicates.',
            },
            creativeDistance: {
              type: 'number',
              description: 'How far this direction moves from the straightforward interpretation through visible art direction, not extra UI density. Use 0 for the first idea, then increase with each branch.',
            },
            intent: {
              type: 'string',
              description: 'A short note explaining what this branch is trying to accomplish.',
            },
          },
          required: [
            'name',
            'direction',
            'description',
            'header',
            'primaryCta',
            'supportingUi',
            'imagery',
            'tone',
            'differentFromPrevious',
            'avoidOverlapWithOtherBranches',
            'creativeDistance',
            'intent',
          ],
        },
      },
    },
    required: ['ideas'],
  },
});

export const individualDesignPromptSchema = (): ResponseJSONSchema => ({
  type: 'json_schema',
  name: 'codex_12ui_individual_design_prompt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        type: 'string',
        description: 'A concise name for this planned design branch.',
      },
      interpretation: {
        type: 'string',
        description: 'How this planner interpreted the assigned idea before writing the final prompt.',
      },
      directionFidelity: {
        type: 'string',
        description: 'How the final prompt preserves the assigned direction, component fields, anti-overlap note, and branch-specific visual differentiators.',
      },
      visualDifferentiators: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: { type: 'string' },
        description: 'Concrete visual traits that should make this rendered branch distinct from sibling branches.',
      },
      prompt: {
        type: 'string',
        description: 'The final positive image-generation prompt for one full-screen web interface.',
      },
    },
    required: ['title', 'interpretation', 'directionFidelity', 'visualDifferentiators', 'prompt'],
  },
});
