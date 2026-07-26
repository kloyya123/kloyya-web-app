import { describe, expect, it } from 'vitest';
import { ApiError } from '../http/errors';
import { assertAllowedMimeType, isAllowedMimeType, normaliseMimeType } from './mime';

describe('normaliseMimeType', () => {
  it('drops parameters and casing', () => {
    expect(normaliseMimeType('TEXT/PLAIN; charset=UTF-8')).toBe('text/plain');
    expect(normaliseMimeType('  application/PDF  ')).toBe('application/pdf');
  });

  it('returns an empty string for an empty declaration', () => {
    expect(normaliseMimeType('')).toBe('');
  });
});

describe('isAllowedMimeType', () => {
  it('accepts the document types Kloyya can actually read', () => {
    for (const type of [
      'text/plain',
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
    ]) {
      expect(isAllowedMimeType(type), type).toBe(true);
    }
  });

  it('refuses anything the browser would render as markup', () => {
    // The reason this module exists: a stored object is served back over a
    // signed URL, and these types execute script when fetched.
    for (const type of [
      'text/html',
      'text/html; charset=utf-8',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/javascript',
      'application/javascript',
      'application/xml',
    ]) {
      expect(isAllowedMimeType(type), type).toBe(false);
    }
  });

  it('refuses executables and archives that were never supported', () => {
    for (const type of [
      'application/x-msdownload',
      'application/x-sh',
      'application/octet-stream',
      'application/zip',
    ]) {
      expect(isAllowedMimeType(type), type).toBe(false);
    }
  });

  it('refuses an absent or blank declaration rather than defaulting', () => {
    expect(isAllowedMimeType('')).toBe(false);
    expect(isAllowedMimeType('   ')).toBe(false);
  });

  it('is not fooled by a parameter appended to a banned type', () => {
    expect(isAllowedMimeType('image/svg+xml; charset=utf-8')).toBe(false);
    expect(isAllowedMimeType('TEXT/HTML')).toBe(false);
  });
});

describe('assertAllowedMimeType', () => {
  it('returns the normalised type so the row and the object agree', () => {
    expect(assertAllowedMimeType('TEXT/PLAIN; charset=utf-8', 'notes.txt')).toBe('text/plain');
  });

  it('throws a 415 naming the file, not a generic failure', () => {
    try {
      assertAllowedMimeType('text/html', 'payload.html');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const api = error as ApiError;
      expect(api.httpStatus).toBe(415);
      expect(api.errorCode).toBe('unsupported_file_type');
      expect(api.message).toContain('payload.html');
      // The user is told what to do instead, not just that it failed.
      expect(api.suggestedResolution.length).toBeGreaterThan(0);
    }
  });
});
