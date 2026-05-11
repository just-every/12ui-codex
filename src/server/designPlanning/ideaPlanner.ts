import {
  ensembleRequest,
  ensembleResult,
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
} from '@just-every/ensemble';
import { projectRoot, serverConfig } from '../config.js';
import { describePlanningImages, buildPlanningImages, planningImageContent } from './images.js';
import { parseDesignIdeas } from './parse.js';
import { ideaPlanSchema } from './schemas.js';
import type { DesignIdea, DesignPlanningRequest } from './types.js';

const ideaPlannerInstruction = [
  'Plan lightweight creative directions for a set of generated web interface designs.',
  'Stay narrow: do not lay out the whole page, write the final image prompt, or solve detailed visual composition here.',
  'The first idea should be the plainest, most straightforward implementation of the user request.',
  'For the first idea, use a natural title that names the requested page, product, or interface. Do not title it Faithful, Primary, Baseline, Direct, Straightforward, Literal, or similar generic planning labels.',
  'Each later idea should move further from the obvious solution than the previous one by shifting design angle, interaction model, composition, density, or visual language.',
  'If the user asks for a specific style, brand language, era, or aesthetic, keep all ideas recognizably inside that request while varying the interpretation.',
  'Return positive directions only. Do not include a negative prompt.',
].join(' ');

export const planDesignIdeas = async (request: DesignPlanningRequest): Promise<DesignIdea[]> => {
  const images = buildPlanningImages(request);
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        `Create exactly ${request.batchSize} lightweight design ideas for a browser-based 12ui sketch-to-interface tool.`,
        `User prompt: ${request.prompt || '(no written prompt; use the attached sketch/assets as the primary direction)'}`,
        `Aspect: ${request.aspect}. Quality target: ${request.quality}.`,
        describePlanningImages(images),
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
    model: serverConfig.textModel,
    cwd: projectRoot,
    instructions: 'You plan concise, branch-level UI design ideas. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: ideaPlanSchema(request.batchSize),
    },
  };
  const result = await ensembleResult(ensembleRequest(messages, agent));
  if (result.error) throw new Error(result.error);
  return parseDesignIdeas(result.message, request.batchSize);
};
