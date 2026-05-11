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
            title: {
              type: 'string',
              description: 'A natural name for this design idea. The first title should name the requested interface itself, not a generic label.',
            },
            direction: {
              type: 'string',
              description: 'The lightweight creative direction for this branch.',
            },
            creativeDistance: {
              type: 'number',
              description: 'How far this direction moves from the straightforward interpretation. Use 0 for the first idea, then increase with each branch.',
            },
            intent: {
              type: 'string',
              description: 'A short note explaining what this branch is trying to accomplish.',
            },
          },
          required: ['title', 'direction', 'creativeDistance', 'intent'],
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
      prompt: {
        type: 'string',
        description: 'The final positive image-generation prompt for one full-screen web interface.',
      },
    },
    required: ['title', 'interpretation', 'prompt'],
  },
});
