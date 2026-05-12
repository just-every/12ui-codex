import { describe, expect, it } from 'vitest';
import {
  isImageDataUrl,
  normalizeDirectDesignCount,
  normalizeBatchSize,
  parseCreateRunRequest,
  parseCreateWorkspaceRequest,
  parseDirectCreateHandoverRequest,
  parsePlanWorkspacePagesRequest,
  parseDesignId,
  parseRunId,
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

  it('validates run ids', () => {
    expect(parseRunId('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
    expect(() => parseRunId('x')).toThrow('A valid run id is required.');
    expect(() => parseRunId('%2e%2e%2f%2e%2e%2fetc')).toThrow('A valid run id is required.');
  });

  it('parses create workspaces with seed variation count', () => {
    expect(parseCreateWorkspaceRequest({
      prompt: 'Create UI',
      seedVariationCount: 12,
      aspect: 'landscape',
      quality: 'high',
    })).toMatchObject({
      prompt: 'Create UI',
      seedVariationCount: 12,
      aspect: 'landscape',
      quality: 'high',
    });
  });

  it('parses page plan prompt without a client-selected count', () => {
    expect(parsePlanWorkspacePagesRequest({ pageCount: 99, pagePrompt: ' settings and billing ' })).toEqual({
      pagePrompt: 'settings and billing',
    });
    expect(parsePlanWorkspacePagesRequest({ pageCount: 0 })).toEqual({});
  });
});
