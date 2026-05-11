import { describe, expect, it } from 'vitest';
import {
  isImageDataUrl,
  normalizeDirectDesignCount,
  normalizeCreativityMode,
  normalizeBatchSize,
  parseCreateRunRequest,
  parseCreateWorkspaceRequest,
  parseCreateWorkspaceSeedRunRequest,
  parseDesignImageEditRequest,
  parseDesignImageExtensionRequest,
  parseDirectCreateHandoverRequest,
  parsePlanWorkspacePagesRequest,
  parseUpdateDesignActiveRevisionRequest,
  parseUpdateWorkspacePageRunRequest,
  parseUpdateWorkspacePlannerRequest,
  parseUpdateWorkspaceSeedRunRequest,
  parseDesignId,
} from './validation.js';

describe('validation', () => {
  it('accepts generation batch sizes of one, three, six, or twelve', () => {
    expect(normalizeBatchSize(undefined)).toBe(3);
    expect(normalizeBatchSize(1)).toBe(1);
    expect(normalizeBatchSize(3)).toBe(3);
    expect(normalizeBatchSize(6)).toBe(6);
    expect(normalizeBatchSize(12)).toBe(12);
    expect(() => normalizeBatchSize(2)).toThrow('Batch size must be one of 1, 3, 6, or 12.');
  });

  it('accepts direct workflow counts of one, three, six, or twelve', () => {
    expect(normalizeDirectDesignCount(undefined)).toBe(3);
    expect(normalizeDirectDesignCount(1)).toBe(1);
    expect(normalizeDirectDesignCount(3)).toBe(3);
    expect(normalizeDirectDesignCount(6)).toBe(6);
    expect(normalizeDirectDesignCount(12)).toBe(12);
    expect(() => normalizeDirectDesignCount(2)).toThrow('Direct design count must be one of 1, 3, 6, or 12.');
  });

  it('accepts creativity modes', () => {
    expect(normalizeCreativityMode(undefined)).toBe('standard');
    expect(normalizeCreativityMode('standard')).toBe('standard');
    expect(normalizeCreativityMode('creative')).toBe('creative');
    expect(normalizeCreativityMode('explorer')).toBe('creative');
    expect(normalizeCreativityMode('wild')).toBe('standard');
  });

  it('accepts prompt-only requests', () => {
    expect(parseCreateRunRequest({
      prompt: 'A dashboard',
      batchSize: 3,
      aspect: 'landscape',
      quality: 'high',
    })).toEqual({
      prompt: 'A dashboard',
      sketchDataUrl: null,
      referenceDataUrls: [],
      batchSize: 3,
      aspect: 'landscape',
      quality: 'high',
      creativityMode: 'standard',
    });
  });

  it('accepts image data URLs', () => {
    expect(isImageDataUrl('data:image/png;base64,aGVsbG8=')).toBe(true);
    expect(isImageDataUrl('https://example.com/image.png')).toBe(false);
  });

  it('requires prompt or sketch', () => {
    expect(() => parseCreateRunRequest({ prompt: '   ' })).toThrow('Prompt or sketch is required.');
  });

  it('defaults direct create handover to three designs', () => {
    expect(parseDirectCreateHandoverRequest({ prompt: 'Dashboard' })).toMatchObject({
      prompt: 'Dashboard',
      referenceDataUrls: [],
      designCount: 3,
      aspect: 'portrait',
      quality: 'medium',
      creativityMode: 'standard',
    });
  });

  it('accepts reference image data URLs', () => {
    expect(parseCreateRunRequest({
      prompt: 'A dashboard',
      referenceDataUrls: ['data:image/png;base64,aGVsbG8=', 'https://example.com/nope.png'],
    })).toMatchObject({
      referenceDataUrls: ['data:image/png;base64,aGVsbG8='],
    });
  });

  it('validates design ids', () => {
    expect(parseDesignId('design-1')).toBe('design-1');
    expect(() => parseDesignId('../design-1')).toThrow('A valid designId is required.');
  });

  it('parses active workspace run changes', () => {
    expect(parseUpdateWorkspaceSeedRunRequest({ runId: 'seed-run-1' })).toEqual({ runId: 'seed-run-1' });
    expect(parseUpdateWorkspacePageRunRequest({ runId: 'page-run-1' })).toEqual({ runId: 'page-run-1' });
    expect(() => parseUpdateWorkspaceSeedRunRequest({ runId: '../run-1' })).toThrow('A valid runId is required.');
  });

  it('parses create workspaces with seed variation count', () => {
    expect(parseCreateWorkspaceRequest({
      prompt: 'Create UI',
      seedVariationCount: 12,
      aspect: 'landscape',
      quality: 'high',
      creativityMode: 'creative',
    })).toMatchObject({
      prompt: 'Create UI',
      seedVariationCount: 12,
      aspect: 'landscape',
      quality: 'high',
      creativityMode: 'creative',
    });
  });

  it('parses seed runs with editable workspace inputs', () => {
    expect(parseCreateWorkspaceSeedRunRequest({
      prompt: ' Updated UI ',
      sketchDataUrl: 'data:image/png;base64,aGVsbG8=',
      referenceDataUrls: ['data:image/png;base64,aGVsbG8='],
      seedVariationCount: 6,
      aspect: 'landscape',
      quality: 'high',
      creativityMode: 'creative',
    })).toEqual({
      prompt: 'Updated UI',
      sketchDataUrl: 'data:image/png;base64,aGVsbG8=',
      referenceDataUrls: ['data:image/png;base64,aGVsbG8='],
      seedVariationCount: 6,
      aspect: 'landscape',
      quality: 'high',
      creativityMode: 'creative',
    });
  });

  it('parses page plan prompt without a client-selected count', () => {
    expect(parsePlanWorkspacePagesRequest({ pageCount: 99, pagePrompt: ' settings and billing ' })).toEqual({
      pagePrompt: 'settings and billing',
    });
    expect(parsePlanWorkspacePagesRequest({ pageCount: 0 })).toEqual({});
    expect(parsePlanWorkspacePagesRequest({ pagePrompt: '   ' })).toEqual({});
  });

  it('parses workspace planner state updates', () => {
    expect(parseUpdateWorkspacePlannerRequest({
      plannerVisible: true,
      plannerPrompt: ' Generate pricing and docs pages. ',
    })).toEqual({
      plannerVisible: true,
      plannerPrompt: 'Generate pricing and docs pages.',
    });
    expect(() => parseUpdateWorkspacePlannerRequest({
      plannerVisible: 'yes',
    })).toThrow('plannerVisible must be a boolean.');
  });

  it('requires a prompt for full-image edits', () => {
    expect(() => parseDesignImageEditRequest({ prompt: '   ' })).toThrow(
      'Prompt is required when editing the full image.',
    );
    expect(parseDesignImageEditRequest({ prompt: ' make it calmer ', sourceRevisionId: null })).toEqual({
      prompt: 'make it calmer',
      maskDataUrl: null,
      sourceRevisionId: null,
    });
  });

  it('accepts PNG masks for image edits', () => {
    expect(parseDesignImageEditRequest({
      prompt: '',
      maskDataUrl: 'data:image/png;base64,aGVsbG8=',
      sourceRevisionId: 'revision-1',
    })).toEqual({
      prompt: null,
      maskDataUrl: 'data:image/png;base64,aGVsbG8=',
      sourceRevisionId: 'revision-1',
    });
    expect(() => parseDesignImageEditRequest({
      maskDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
    })).toThrow('maskDataUrl must be a PNG data URL.');
  });

  it('only accepts bottom image extensions', () => {
    expect(parseDesignImageExtensionRequest({
      direction: 'bottom',
      nextPagePrompt: 'pricing details',
    })).toEqual({
      direction: 'bottom',
      nextPagePrompt: 'pricing details',
      sourceRevisionId: undefined,
    });
    expect(() => parseDesignImageExtensionRequest({ direction: 'right' })).toThrow('direction must be bottom.');
  });

  it('parses active revision changes', () => {
    expect(parseUpdateDesignActiveRevisionRequest({ activeRevisionId: null })).toEqual({
      activeRevisionId: null,
    });
    expect(parseUpdateDesignActiveRevisionRequest({ activeRevisionId: 'revision-1' })).toEqual({
      activeRevisionId: 'revision-1',
    });
  });
});
