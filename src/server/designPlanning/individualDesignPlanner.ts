import {
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
} from '@just-every/ensemble';
import { projectRoot, serverConfig } from '../config.js';
import { requestTextModelWithFallback } from '../textModelRequest.js';
import { baseCreateGuidance } from '../promptGuidance.js';
import { describePlanningImages, buildPlanningImages, planningImageContent } from './images.js';
import { parseIndividualDesignPrompt } from './parse.js';
import { individualDesignPromptSchema } from './schemas.js';
import type { DesignIdea, DesignPlanningRequest, IndividualDesignPrompt } from './types.js';

const individualPlannerInstruction = [
  'Write one final positive image-generation prompt for the assigned design idea.',
  'This is the detailed planning stage: decide layout, hierarchy, visual system, content density, copy treatment, interaction feel, and how attached images should influence the design.',
  'Respect the assigned idea as this branch’s creative direction instead of blending in other branches.',
  'Preserve the assigned component fields: description, header, primary CTA, supporting UI, imagery, tone, differentFromPrevious, and avoidOverlapWithOtherBranches should all be reflected in the final prompt.',
  'Do not neutralize the branch by falling back to generic polished SaaS language. Make the final prompt visibly commit to this branch’s assigned visual system, component construction, imagery approach, and action treatment.',
  'If any global guidance conflicts with the assigned branch style, preserve output framing and usability constraints, but let the assigned branch direction control the visual language.',
  'Write the final prompt so another branch with the same user prompt would not naturally render the same header, CTA, supporting UI, imagery, tone, or density.',
  'Keep the original user prompt as the source of truth. The idea may elaborate or stretch the request, but it should not contradict explicit user constraints.',
  'For branch 1, make the result the plainest polished implementation of the user request, without adding an extra concept or metaphor.',
  'For later branches, make the output progressively more imaginative according to the assigned direction and creative distance.',
  'Describe a single cohesive full-screen web page or product interface, edge to edge.',
  'Do not write a negative prompt field. Put any necessary constraints directly into the positive final prompt as normal art direction.',
].join(' ');

const creativityModeInstruction = (request: DesignPlanningRequest, idea: DesignIdea): string => (
  request.creativityMode === 'creative'
    ? [
      'Creativity mode: Creative.',
      'Commit to the assigned branch as a visually distinctive art direction, but do not translate creativity into a busier interface.',
      'Bias toward minimalism unless the user specifically requested a dense, maximal, data-heavy, or control-heavy interface.',
      'Preserve usability, hierarchy, and the explicit brief. Make the creative leap through composition, typography, imagery, material language, color, and spatial rhythm.',
      'Prefer one dominant visual idea with supporting UI around it. Avoid stacking many equal-weight widgets or turning the page into a dense control room unless the user explicitly asked for that.',
      'If the assigned direction is unusual, make it clearer and more visual, not more complicated.',
      `This branch has creativeDistance ${idea.creativeDistance}; earn that distance through visible art direction, not extra UI density.`,
      'Make sibling branches hard to confuse by giving this one a distinct layout silhouette, visual motif, hero treatment, material palette, and content rhythm.',
    ].join(' ')
    : [
      'Creativity mode: Standard.',
      'Write a distinct but practical final prompt that stays recognizably close to the user’s requested interface.',
    ].join(' ')
);

export const planIndividualDesignPrompt = async (
  request: DesignPlanningRequest,
  idea: DesignIdea,
): Promise<IndividualDesignPrompt> => {
  const images = buildPlanningImages(request);
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        `Plan final image-generation prompt for branch ${idea.branchIndex} of ${request.batchSize}.`,
        `User prompt: ${request.prompt || '(no written prompt; use the attached sketch/assets as the primary direction)'}`,
        `Aspect: ${request.aspect}. Quality target: ${request.quality}. Creativity mode: ${request.creativityMode}.`,
        describePlanningImages(images),
        'Assigned idea:',
        JSON.stringify({
          name: idea.name,
          direction: idea.direction,
          description: idea.description,
          header: idea.header,
          primaryCta: idea.primaryCta,
          supportingUi: idea.supportingUi,
          imagery: idea.imagery,
          tone: idea.tone,
          differentFromPrevious: idea.differentFromPrevious,
          avoidOverlapWithOtherBranches: idea.avoidOverlapWithOtherBranches,
          creativeDistance: idea.creativeDistance,
          intent: idea.intent,
        }, null, 2),
        baseCreateGuidance,
        creativityModeInstruction(request, idea),
        individualPlannerInstruction,
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
    agent_id: `codex-12ui-design-planner-${idea.branchIndex}`,
    cwd: projectRoot,
    instructions: 'You turn one branch-level UI design idea into one concrete image-generation prompt. Follow the requested JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: individualDesignPromptSchema(),
    },
  };
  return requestTextModelWithFallback({
    agent,
    label: `Design prompt planning for branch ${idea.branchIndex}`,
    messages,
    parse: (message) => parseIndividualDesignPrompt(message, idea.branchIndex),
  });
};

export const planIndividualDesignPrompts = async (
  request: DesignPlanningRequest,
  ideas: DesignIdea[],
): Promise<IndividualDesignPrompt[]> => (
  Promise.all(ideas.map((idea) => planIndividualDesignPrompt(request, idea)))
);
