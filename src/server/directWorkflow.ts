import path from 'node:path';
import {
  type AgentDefinition,
  type ResponseContent,
  type ResponseInput,
  type ResponseJSONSchema,
} from '@just-every/ensemble';
import type {
  DesignOutput,
  DesignRun,
  DirectCreateHandoverRequest,
  DirectCreateHandoverResult,
  SelectedDesign,
} from '../shared/types.js';
import { projectRoot, serverConfig } from './config.js';
import { submitTwelveUiHandover } from './twelveUi.js';
import { addHandover, addRunEvent, createRunRecord, readRun, runDir } from './runStore.js';
import { startGeneration } from './generation.js';
import { requestTextModelWithFallback } from './textModelRequest.js';

type CandidateDesign = {
  candidateId: string;
  run: DesignRun;
  design: DesignOutput;
  absoluteAssetPath: string;
};

const pickerSchema = (candidateIds: string[]): ResponseJSONSchema => ({
  type: 'json_schema',
  name: 'codex_12ui_selected_design',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      candidateId: { type: 'string', enum: candidateIds },
      reason: { type: 'string' },
    },
    required: ['candidateId', 'reason'],
  },
});

const createCompletedRun = async (
  request: DirectCreateHandoverRequest,
): Promise<DesignRun> => {
  const runRequest = {
    prompt: request.prompt,
    sketchDataUrl: request.sketchDataUrl,
    referenceDataUrls: request.referenceDataUrls,
    batchSize: request.designCount,
    aspect: request.aspect,
    quality: request.quality,
    creativityMode: request.creativityMode,
  };
  const run = await createRunRecord(runRequest);
  await addRunEvent(run.id, {
    type: 'queued',
    message: 'Direct workflow generation queued.',
    progress: 0,
  });
  await startGeneration(run.id, runRequest);
  const completed = await readRun(run.id);
  if (completed.status !== 'completed') {
    throw new Error(completed.error || `Direct workflow generation ended with ${completed.status}.`);
  }
  return completed;
};

const collectCandidates = (runs: DesignRun[]): CandidateDesign[] => (
  runs.flatMap((run) => run.designs.map((design) => ({
    candidateId: `candidate-${run.id}-${design.id}`,
    run,
    design,
    absoluteAssetPath: path.join(runDir(run.id), design.assetPath),
  })))
);

const pickSingleCandidate = (candidate: CandidateDesign): SelectedDesign => ({
  candidateId: candidate.candidateId,
  runId: candidate.run.id,
  designId: candidate.design.id,
  title: candidate.design.title,
  reason: 'Only one design was requested.',
});

export const pickDesignForHandover = async (
  request: DirectCreateHandoverRequest,
  candidates: CandidateDesign[],
): Promise<SelectedDesign> => {
  if (candidates.length === 0) throw new Error('No generated designs were available to pick from.');
  if (candidates.length === 1) return pickSingleCandidate(candidates[0]);

  const candidateSummary = candidates.map((candidate, index) => (
    [
      `Candidate ${index + 1}`,
      `candidateId: ${candidate.candidateId}`,
      `title: ${candidate.design.title}`,
      `prompt: ${candidate.design.prompt}`,
    ].join('\n')
  )).join('\n\n');
  const content: ResponseContent = [
    {
      type: 'input_text',
      text: [
        'Pick the single generated interface image that should be converted to HTML by 12ui.',
        'Prioritize faithfulness to the user prompt and sketch, visual completeness, implementability, clear hierarchy, and avoiding illegible or broken UI.',
        `User prompt: ${request.prompt || '(sketch only)'}`,
        `Aspect: ${request.aspect}. Quality: ${request.quality}. Creativity mode: ${request.creativityMode}.`,
        '',
        candidateSummary,
        '',
        'The images are attached in the same order as the candidate list. Return the selected candidateId and a concise reason.',
      ].join('\n'),
    },
    ...candidates.map((candidate) => ({
      type: 'input_image' as const,
      image_url: candidate.absoluteAssetPath,
      detail: 'high' as const,
    })),
  ];
  const messages: ResponseInput = [{ type: 'message', role: 'user', content }];
  const agent: AgentDefinition = {
    agent_id: 'codex-12ui-direct-picker',
    cwd: projectRoot,
    instructions: 'You are selecting the best generated web interface image for conversion to HTML. Follow the JSON schema exactly.',
    modelSettings: {
      codex_home: serverConfig.codexHome,
      json_schema: pickerSchema(candidates.map((candidate) => candidate.candidateId)),
    },
  };
  const parsed = await requestTextModelWithFallback({
    agent,
    label: 'Direct workflow design picker',
    messages,
    parse: (message) => JSON.parse(message) as { candidateId?: unknown; reason?: unknown },
  });
  const candidateId = typeof parsed.candidateId === 'string' ? parsed.candidateId : '';
  const selected = candidates.find((candidate) => candidate.candidateId === candidateId);
  if (!selected) throw new Error(`Picker selected unknown candidateId: ${candidateId}`);
  return {
    candidateId: selected.candidateId,
    runId: selected.run.id,
    designId: selected.design.id,
    title: selected.design.title,
    reason: typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : 'Selected by the direct workflow picker.',
  };
};

export const runDirectCreateHandover = async (
  request: DirectCreateHandoverRequest,
): Promise<DirectCreateHandoverResult> => {
  const runs = [await createCompletedRun(request)];
  const candidates = collectCandidates(runs);
  if (candidates.length !== request.designCount) {
    throw new Error(`Direct workflow generated ${candidates.length} designs; expected ${request.designCount}.`);
  }
  const selected = await pickDesignForHandover(request, candidates);
  const selectedCandidate = candidates.find((candidate) => candidate.candidateId === selected.candidateId);
  if (!selectedCandidate) throw new Error(`Selected candidate ${selected.candidateId} was not found.`);
  await addRunEvent(selected.runId, {
    type: 'handover',
    message: `Direct workflow selected ${selected.title}: ${selected.reason}`,
    progress: selectedCandidate.run.progress,
  });
  const handover = await submitTwelveUiHandover({
    runId: selected.runId,
    designId: selected.designId,
    assetPath: selectedCandidate.design.assetPath,
  });
  const updatedRun = await addHandover(selected.runId, handover);
  return {
    status: 'completed',
    request,
    runs: runs.map((run) => run.id === updatedRun.id ? updatedRun : run),
    selected,
    handover,
  };
};
