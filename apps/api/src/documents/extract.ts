import mammoth from 'mammoth';

/**
 * Pulling searchable text out of an uploaded file.
 *
 * What comes back is what full-text search and Ask Kloyya read, so a document
 * becomes as findable as an email. Coverage is deliberately staged for the beta:
 *
 *  • text/*, .txt, .md, .csv, .json, .log — decoded directly, no dependency.
 *  • .docx — mammoth (pure JS, reliable).
 *  • PDF, XLSX, PPTX, images — stored and searchable by filename for now;
 *    their extractors (and OCR for scans) land later. Returning '' here is not a
 *    failure, it just means "no body text yet".
 *
 * Extraction never throws: a malformed file must not fail the upload. A file that
 * can't be read is stored and searchable by its name — losing the upload would be
 * the worse outcome.
 */

/** A cap so one enormous file can't bloat a row or a prompt. */
const MAX_CHARS = 200_000;

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'text']);

export async function extractText(
  bytes: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const type = mimeType.toLowerCase();
  const ext = filename.toLowerCase().split('.').pop() ?? '';

  try {
    if (type.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) {
      return bytes.toString('utf8').slice(0, MAX_CHARS);
    }

    if (type.includes('wordprocessingml') || ext === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      return value.slice(0, MAX_CHARS);
    }

    // PDF/XLSX/PPTX/images: kept, searchable by name until their extractors land.
    return '';
  } catch {
    return '';
  }
}
