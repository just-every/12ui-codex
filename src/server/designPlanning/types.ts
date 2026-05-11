import type { CreateRunRequest } from '../../shared/types.js';

export type DesignPlanningImage = {
  label: string;
  dataUrl: string;
};

export type DesignIdea = {
  branchIndex: number;
  name: string;
  direction: string;
  description: string;
  header: string;
  primaryCta: string;
  supportingUi: string;
  imagery: string;
  tone: string;
  differentFromPrevious: string;
  avoidOverlapWithOtherBranches: string;
  creativeDistance: number;
  intent: string;
};

export type IndividualDesignPrompt = {
  branchIndex: number;
  title: string;
  prompt: string;
  interpretation: string;
  directionFidelity: string;
  visualDifferentiators: string[];
};

export type DesignPlanningRequest = CreateRunRequest;
