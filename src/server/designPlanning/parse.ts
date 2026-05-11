import type { DesignIdea, IndividualDesignPrompt } from './types.js';

const readObject = (raw: string): Record<string, unknown> => {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Planner returned a non-object response.');
  }
  return parsed as Record<string, unknown>;
};

const readTrimmedString = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string => {
  const value = typeof record[key] === 'string' ? record[key].trim() : '';
  if (!value) throw new Error(`${label} is missing ${key}.`);
  return value;
};

const readTrimmedStringArray = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string[] => {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${label} is missing ${key}.`);
  const items = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  if (items.length <= 0) throw new Error(`${label} is missing ${key}.`);
  return items;
};

export const parseDesignIdeas = (raw: string, count: number): DesignIdea[] => {
  const parsed = readObject(raw);
  if (!Array.isArray(parsed.ideas) || parsed.ideas.length !== count) {
    throw new Error(`Idea planner returned ${Array.isArray(parsed.ideas) ? parsed.ideas.length : 0} ideas; expected ${count}.`);
  }
  return parsed.ideas.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Idea ${index + 1} is not an object.`);
    }
    const record = entry as Record<string, unknown>;
    const creativeDistance = Number(record.creativeDistance);
    if (!Number.isFinite(creativeDistance)) {
      throw new Error(`Idea ${index + 1} is missing creativeDistance.`);
    }
    return {
      branchIndex: index + 1,
      name: readTrimmedString(record, 'name', `Idea ${index + 1}`),
      direction: readTrimmedString(record, 'direction', `Idea ${index + 1}`),
      description: readTrimmedString(record, 'description', `Idea ${index + 1}`),
      header: readTrimmedString(record, 'header', `Idea ${index + 1}`),
      primaryCta: readTrimmedString(record, 'primaryCta', `Idea ${index + 1}`),
      supportingUi: readTrimmedString(record, 'supportingUi', `Idea ${index + 1}`),
      imagery: readTrimmedString(record, 'imagery', `Idea ${index + 1}`),
      tone: readTrimmedString(record, 'tone', `Idea ${index + 1}`),
      differentFromPrevious: readTrimmedString(record, 'differentFromPrevious', `Idea ${index + 1}`),
      avoidOverlapWithOtherBranches: readTrimmedString(record, 'avoidOverlapWithOtherBranches', `Idea ${index + 1}`),
      creativeDistance,
      intent: readTrimmedString(record, 'intent', `Idea ${index + 1}`),
    };
  });
};

export const parseIndividualDesignPrompt = (
  raw: string,
  branchIndex: number,
): IndividualDesignPrompt => {
  const parsed = readObject(raw);
  return {
    branchIndex,
    title: readTrimmedString(parsed, 'title', `Design prompt ${branchIndex}`),
    interpretation: readTrimmedString(parsed, 'interpretation', `Design prompt ${branchIndex}`),
    directionFidelity: readTrimmedString(parsed, 'directionFidelity', `Design prompt ${branchIndex}`),
    visualDifferentiators: readTrimmedStringArray(parsed, 'visualDifferentiators', `Design prompt ${branchIndex}`),
    prompt: readTrimmedString(parsed, 'prompt', `Design prompt ${branchIndex}`),
  };
};
