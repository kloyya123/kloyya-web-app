import mammoth from 'mammoth';
import JSZip from 'jszip';
import { getDocumentProxy, extractText as extractPdfText } from 'unpdf';
import * as XLSX from 'xlsx';
import { config } from '../config';

/**
 * Pulling searchable text out of an uploaded file.
 *
 * What comes back is what full-text search and Ask Kloyya read, so a document
 * becomes as findable as an email.
 *
 *  • text/*, .txt, .md, .csv, .json, .log — decoded directly, no dependency.
 *  • .docx — mammoth (pure JS).
 *  • .pdf — unpdf (pdf.js compiled for serverless; no native canvas dependency
 *    — that only loads for image-rendering functions, which we never call).
 *  • .xlsx/.xls — SheetJS, every sheet flattened to CSV-ish text.
 *  • .pptx — the raw OOXML zip's slide XML, text runs extracted by hand (a
 *    full OOXML parser is unnecessary just to pull `<a:t>` runs out).
 *  • images — transcribed by the configured AI provider's vision endpoint, so a
 *    photographed or scanned page becomes searchable text like any other upload.
 *    Follows AI_PROVIDER rather than being pinned to one vendor; without a key
 *    configured it degrades honestly: stored and searchable by filename only,
 *    same as everything else that can't be read.
 *
 * Extraction never throws: a malformed file must not fail the upload. A file
 * that can't be read is stored and searchable by its name — losing the upload
 * would be the worse outcome.
 */

/** A cap so one enormous file can't bloat a row or a prompt. */
const MAX_CHARS = 200_000;

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'text']);

export interface ExtractOptions {
  /** Injectable so tests never touch the network (image transcription only). */
  fetchImpl?: typeof fetch;
  /** Test-only: override the vision credentials instead of reading `config`,
   *  which resolves once at import time and can't be patched after the fact. */
  visionApiKey?: string;
  visionModel?: string;
}

export async function extractText(
  bytes: Buffer,
  mimeType: string,
  filename: string,
  opts: ExtractOptions = {},
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

    if (type === 'application/pdf' || ext === 'pdf') {
      return await extractPdf(bytes);
    }

    if (type.includes('spreadsheetml') || ext === 'xlsx' || ext === 'xls') {
      return extractXlsx(bytes);
    }

    if (type.includes('presentationml') || ext === 'pptx') {
      return await extractPptx(bytes);
    }

    if (type.startsWith('image/')) {
      return await extractImageText(bytes, type, opts);
    }

    // Anything else: kept, searchable by name until an extractor lands.
    return '';
  } catch {
    return '';
  }
}

async function extractPdf(bytes: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return text.slice(0, MAX_CHARS);
}

function extractXlsx(bytes: Buffer): string {
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csv) sheets.push(`# ${sheetName}\n${csv}`);
  }
  return sheets.join('\n\n').slice(0, MAX_CHARS);
}

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;
const TEXT_RUN = /<a:t>([^<]*)<\/a:t>/g;

async function extractPptx(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .map((name) => ({ name, num: Number(SLIDE_PATH.exec(name)?.[1]) }))
    .filter((f) => !Number.isNaN(f.num))
    .sort((a, b) => a.num - b.num);

  const slides: string[] = [];
  for (const { name } of slideFiles) {
    const xml = await zip.files[name]!.async('text');
    const runs = [...xml.matchAll(TEXT_RUN)].map((m) => unescapeXml(m[1] ?? ''));
    if (runs.length) slides.push(runs.join(' '));
  }
  return slides.join('\n').slice(0, MAX_CHARS);
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const OPENAI_VISION_URL = 'https://api.openai.com/v1/chat/completions';
const PERPLEXITY_VISION_URL = 'https://api.perplexity.ai/chat/completions';

interface VisionTarget {
  url: string;
  apiKey: string;
  model: string;
  /** Provider-specific body fields merged into the request. */
  extra?: Record<string, unknown>;
}

/**
 * Where to send an image for transcription, or null when OCR is unavailable.
 *
 * This follows `AI_PROVIDER` rather than hard-coding one vendor. It previously
 * always called OpenAI, which meant that switching the app to another provider
 * left uploads silently unreadable — the request went to an account with no
 * credits and the empty result looked exactly like "this image has no text".
 *
 * Anthropic is deliberately absent: its vision API takes a different content
 * shape, and a wrong guess here fails silently in precisely the same way. Until
 * that shape is implemented and tested, an Anthropic deployment gets the honest
 * filename-only fallback rather than a broken call.
 */
function visionTarget(opts: ExtractOptions): VisionTarget | null {
  // Test overrides win, and keep using the OpenAI-shaped endpoint they expect.
  if (opts.visionApiKey) {
    return {
      url: OPENAI_VISION_URL,
      apiKey: opts.visionApiKey,
      model: opts.visionModel ?? config.OPENAI_MODEL,
    };
  }

  if (config.AI_PROVIDER === 'perplexity') {
    return config.PERPLEXITY_API_KEY
      ? {
          url: PERPLEXITY_VISION_URL,
          apiKey: config.PERPLEXITY_API_KEY,
          model: config.PERPLEXITY_CHAT_MODEL,
          // Transcribe what is on the page — never go looking for related
          // pages on the web and fold them into the "contents" of the upload.
          extra: { disable_search: true },
        }
      : null;
  }

  if (config.AI_PROVIDER === 'openai') {
    return config.OPENAI_API_KEY
      ? { url: OPENAI_VISION_URL, apiKey: config.OPENAI_API_KEY, model: config.OPENAI_MODEL }
      : null;
  }

  return null;
}

/**
 * Transcribe visible text from an image, so a hard copy or handwritten page
 * becomes as searchable as anything typed.
 *
 * A vision call rather than a bundled OCR engine: Tesseract's WASM bundle is
 * large and slower at this scale, and it reads handwriting far less reliably.
 * No key configured is not an error — the caller already treats an empty string
 * as "not readable yet" and keeps the file.
 */
async function extractImageText(
  bytes: Buffer,
  mimeType: string,
  opts: ExtractOptions,
): Promise<string> {
  const target = visionTarget(opts);
  if (!target) return '';

  const doFetch = opts.fetchImpl ?? fetch;
  const response = await doFetch(target.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${target.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: target.model,
      max_tokens: 1024,
      ...target.extra,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe every visible piece of text in this image exactly as it appears, in reading order. Reply with only the transcribed text, or an empty reply if there is none.',
            },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${bytes.toString('base64')}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return '';
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return (body.choices?.[0]?.message?.content ?? '').slice(0, MAX_CHARS);
}
