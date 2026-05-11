import {
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
} from '@just-every/ensemble';
import { projectRoot, serverConfig } from '../config.js';
import { requestTextModelWithFallback } from '../textModelRequest.js';
import { describePlanningImages, buildPlanningImages, planningImageContent } from './images.js';
import { parseDesignIdeas } from './parse.js';
import { ideaPlanSchema } from './schemas.js';
import type { DesignIdea, DesignPlanningRequest } from './types.js';

const ideaPlannerInstruction = [
  'Plan concrete component directions for a set of generated web interface designs.',
  'Think through materially distinct ideas for what the interface components, imagery, typography, density, hierarchy, and action surfaces should look like.',
  'Treat the original user prompt as the guiding star for every direction.',
  'If the user asks for a specific style, brand language, era, or aesthetic, keep every idea recognizably inside that request; vary sub-style, layout emphasis, typography, density, color restraint, imagery, component treatment, and tone instead of replacing the requested style.',
  'The first idea should be the plainest, most straightforward polished implementation of the request.',
  'For the first idea, use a natural name that identifies the requested page, product, or interface. Do not call it Faithful, Primary, Baseline, Direct, Straightforward, Literal, or any similar generic planning label.',
  'Each later idea should feel meaningfully different, like another real avenue a designer could pursue from the same brief, without drifting into an unrelated product or aesthetic.',
  'For each later idea, explicitly name how it differs from the previous idea. Differences should be concrete: visual system, density, typography, component construction, imagery, hierarchy, action treatment, or interaction feel.',
  'For every idea, state what it should avoid sharing with sibling branches so the final image prompts preserve contrast instead of averaging together.',
  'Keep all directions compatible with the same user-requested constraints, but make the component treatment, imagery, tone, and hierarchy distinct enough that the generated designs should not look like near-duplicates.',
  'Stay branch-level: do not write the final image prompt, but make each field specific enough to be turned into one.',
  'Return positive directions only. Do not include a negative prompt.',
].join(' ');

const creativityModeInstruction = (request: DesignPlanningRequest): string => (
  request.creativityMode === 'creative'
    ? [
      'Creativity mode: Creative.',
      'Creative mode is for visually distinctive, art-directed interface concepts, not denser dashboards or more complex product architecture.',
      'Prioritize composition, atmosphere, typography, imagery, color relationships, material treatment, and memorable visual structure.',
      'Keep the interface usable and legible, but reduce informational clutter; each branch should have one clear visual thesis rather than many competing widgets.',
      'Do not make creativity mean more panels, more charts, more navigation, or more controls.',
      'Use bolder layout rhythm, stronger hero treatment, unusual but readable component shapes, expressive imagery, tactile materials, editorial pacing, or cinematic framing when they strengthen the brief.',
      'The first branch can remain the clearest anchor, but it should still feel intentionally art-directed.',
      'Later branches should differ visually, not by adding density. Make each branch distinct through composition, mood, visual metaphor, typography, and interaction surface treatment.',
      'Use high creativeDistance values only when the visual concept is genuinely different while still staying easy to understand.',
    ].join(' ')
    : [
      'Creativity mode: Standard.',
      'Stay close enough to the requested interface that each branch feels like a practical design direction.',
      'Vary component treatment, hierarchy, imagery, density, typography, and tone without turning the brief into a different product or a speculative concept.',
    ].join(' ')
);

export const planDesignIdeas = async (request: DesignPlanningRequest): Promise<DesignIdea[]> => {
  const images = buildPlanningImages(request);
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        `Create exactly ${request.batchSize} concrete component-direction ideas for a browser-based 12ui sketch-to-interface tool.`,
        `User prompt: ${request.prompt || '(no written prompt; use the attached sketch/assets as the primary direction)'}`,
        `Aspect: ${request.aspect}. Quality target: ${request.quality}. Creativity mode: ${request.creativityMode}.`,
        describePlanningImages(images),
        creativityModeInstruction(request),
        ideaPlannerInstruction,
        'Return JSON only.',
      ].join('\n\n'),
    },
    ...planningImageContent(images),
  ];
  const messages: ResponseInput = [{
    type: 'message',
    role: 'user',
    content,
  }];
  const agent: AgentDefinition = {
    agent_id: 'codex-12ui-idea-planner',
    cwd: projectRoot,
    instructions: 'You plan concise, branch-level UI design ideas. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: ideaPlanSchema(request.batchSize),
    },
  };
  return requestTextModelWithFallback({
    agent,
    label: 'Design idea planning',
    messages,
    parse: (message) => parseDesignIdeas(message, request.batchSize),
  });
};
