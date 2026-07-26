import { API_STATUS, ApiError } from '../http/errors';

/**
 * What Kloyya accepts as a document, and what it refuses to store.
 *
 * Both upload paths take the content type from the CLIENT — multipart reads
 * `File.type`, and the signed-URL finalize reads a JSON field — so neither is
 * trustworthy on its own. Before this module the value was passed straight
 * through to Supabase Storage as the object's `content-type` and written to the
 * row unchecked.
 *
 * That mattered because a stored object is later handed back over a signed URL
 * on the Supabase domain. An `text/html` or `image/svg+xml` object fetched from
 * that URL is rendered by the browser, scripts and all, on an origin that holds
 * the storage session — stored XSS with a plausible delivery route. Refusing the
 * type at the door is cheaper than sanitising the payload afterwards.
 *
 * The list is an allowlist and mirrors what `extract.ts` can actually read, plus
 * plain archives of nothing. If a type is not here, Kloyya could not have done
 * anything useful with the file anyway.
 */

/** Types Kloyya can extract text from, or safely store and serve as an attachment. */
const ALLOWED_MIME_TYPES = new Set([
  // Plain text and friends
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  // Portable documents
  'application/pdf',
  // Microsoft Office (OOXML) and the legacy binary formats
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  // OpenDocument
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  // Raster images, for OCR. SVG is deliberately absent: it is XML that executes
  // script, which is the whole problem this module exists to prevent.
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/tiff',
]);

/**
 * Types that must never be stored, even if something later widens the allowlist.
 *
 * Belt and braces: the allowlist above is the control, but a future edit that
 * adds `text/*` wholesale would silently re-open the hole. These are checked by
 * prefix, so `text/html; charset=utf-8` is caught along with bare `text/html`.
 */
const NEVER_ALLOWED_PREFIXES = [
  'text/html',
  'application/xhtml',
  'image/svg',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/xml',
  'text/xml',
];

/** Strip parameters and casing: `TEXT/PLAIN; charset=UTF-8` → `text/plain`. */
export function normaliseMimeType(raw: string): string {
  return (raw.split(';')[0] ?? '').trim().toLowerCase();
}

export function isAllowedMimeType(raw: string): boolean {
  const type = normaliseMimeType(raw);
  if (type.length === 0) return false;
  if (NEVER_ALLOWED_PREFIXES.some((prefix) => type.startsWith(prefix))) return false;
  return ALLOWED_MIME_TYPES.has(type);
}

/**
 * Validate the declared type, returning the normalised form to store.
 *
 * Returns rather than mutates so the caller writes the cleaned value to both the
 * storage object and the database row, and the two cannot disagree.
 */
export function assertAllowedMimeType(raw: string, filename: string): string {
  const type = normaliseMimeType(raw);
  if (!isAllowedMimeType(type)) {
    throw new ApiError({
      httpStatus: API_STATUS.UnsupportedMediaType,
      errorCode: 'unsupported_file_type',
      message: `Kloyya cannot accept "${filename}".`,
      description: type
        ? `Files of type ${type} are not supported.`
        : 'The file did not declare a type Kloyya recognises.',
      suggestedResolution:
        'Upload a document, spreadsheet, presentation, PDF, plain-text file, or image.',
    });
  }
  return type;
}
