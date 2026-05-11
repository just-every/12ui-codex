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
      title: readTrimmedString(record, 'title', `Idea ${index + 1}`),
      direction: readTrimmedString(record, 'direction', `Idea ${index + 1}`),
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
    prompt: readTrimmedString(parsed, 'prompt', `Design prompt ${branchIndex}`),
  };
};
