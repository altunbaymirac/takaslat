import { describe, expect, it } from 'vitest';
import { normalizeInternalRedirect } from './navigation';

describe('normalizeInternalRedirect', () => {
  it('keeps local application paths', () => {
    expect(normalizeInternalRedirect('/listing/abc?tab=details')).toBe('/listing/abc?tab=details');
  });

  it('rejects absolute and protocol-relative destinations', () => {
    expect(normalizeInternalRedirect('https://example.com')).toBe('/');
    expect(normalizeInternalRedirect('//example.com')).toBe('/');
    expect(normalizeInternalRedirect('/\\example.com')).toBe('/');
  });
});
