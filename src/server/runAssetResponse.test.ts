import { describe, expect, it } from 'vitest';
import { etagMatches, notModifiedSince } from './runAssetResponse.js';

describe('run asset HTTP cache helpers', () => {
  it('matches weak etags from a comma-separated If-None-Match header', () => {
    expect(etagMatches('W/"old", W/"abc-123"', 'W/"abc-123"')).toBe(true);
    expect(etagMatches('W/"old"', 'W/"abc-123"')).toBe(false);
    expect(etagMatches('*', 'W/"abc-123"')).toBe(true);
  });

  it('accepts If-Modified-Since only when the request date is current enough', () => {
    expect(notModifiedSince('Mon, 11 May 2026 10:00:00 GMT', 'Mon, 11 May 2026 09:59:59 GMT')).toBe(true);
    expect(notModifiedSince('Mon, 11 May 2026 09:59:58 GMT', 'Mon, 11 May 2026 09:59:59 GMT')).toBe(false);
    expect(notModifiedSince('not a date', 'Mon, 11 May 2026 09:59:59 GMT')).toBe(false);
  });
});
