import type { CreateRunRequest } from '../../shared/types.js';

export type DesignPlanningImage = {
  label: string;
  dataUrl: string;
};

export type DesignIdea = {
  branchIndex: number;
  title: string;
  direction: string;
  creativeDistance: number;
  intent: string;
};

export type IndividualDesignPrompt = {
  branchIndex: number;
  title: string;
  prompt: string;
  interpretation: string;
};

export type DesignPlanningRequest = CreateRunRequest;
