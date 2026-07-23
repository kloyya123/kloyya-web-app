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
 *  • images — transcribed by the configured AI provider's vision endpoint
 *    (OpenAI). Without a key configured, this degrades honestly: stored and
 *    searchable by filename only, same as everything else that can't be read.
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

const VISION_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Transcribe visible text from an image via OpenAI's vision-capable chat
 * completions. Reuses OPENAI_API_KEY/OPENAI_MODEL — no separate OCR key or
 * dependency (Tesseract's WASM bundle is large and slower than a vision call
 * for the beta's scale). No key configured is not an error: the caller already
 * treats an empty string as "not readable yet".
 */
async function extractImageText(
  bytes: Buffer,
  mimeType: string,
  opts: ExtractOptions,
): Promise<string> {
  const apiKey = opts.visionApiKey ?? config.OPENAI_API_KEY;
  if (!apiKey) return '';
  const model = opts.visionModel ?? config.OPENAI_MODEL;

  const doFetch = opts.fetchImpl ?? fetch;
  const response = await doFetch(VISION_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
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
