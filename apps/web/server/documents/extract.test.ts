import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { extractText } from './extract';

/**
 * Extraction across the file types the beta claims to read. Each format gets a
 * small, real (not hand-waved) fixture built in-process — no binary test assets
 * to keep in the repo. The one invariant that matters most across every branch:
 * extraction never throws, even on garbage bytes.
 */
describe('extractText', () => {
  it('decodes plain text directly', async () => {
    const text = await extractText(Buffer.from('hello world'), 'text/plain', 'notes.txt');
    expect(text).toBe('hello world');
  });

  it('extracts every sheet of an .xlsx workbook as text', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Revenue'],
      ['Acme', '140000'],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Q3');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const text = await extractText(
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'forecast.xlsx',
    );

    expect(text).toContain('Q3');
    expect(text).toContain('Acme');
    expect(text).toContain('140000');
  });

  it('extracts text runs from a .pptx, in slide order', async () => {
    const zip = new JSZip();
    // Only the slide XML matters to our extractor — a full OOXML package
    // (content-types, rels, etc.) isn't needed to exercise the text-run regex.
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:sld xmlns:a="a"><a:t>Q3 Kickoff</a:t></p:sld>',
    );
    zip.file(
      'ppt/slides/slide2.xml',
      '<p:sld xmlns:a="a"><a:t>Revenue up 12%</a:t><a:t>&amp; on track</a:t></p:sld>',
    );
    const bytes = await zip.generateAsync({ type: 'nodebuffer' });

    const text = await extractText(
      bytes,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'deck.pptx',
    );

    const lines = text.split('\n');
    expect(lines[0]).toBe('Q3 Kickoff');
    expect(lines[1]).toBe('Revenue up 12% & on track');
  });

  it('transcribes an image via the configured vision provider', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Invoice #4471 — $250.00 due' } }] }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const text = await extractText(Buffer.from('fake-png-bytes'), 'image/png', 'receipt.png', {
      fetchImpl,
      visionApiKey: 'sk-test-key',
      visionModel: 'gpt-4o-mini',
    });

    expect(text).toBe('Invoice #4471 — $250.00 due');
  });

  it('degrades to empty text for an image when no AI provider is configured', async () => {
    // No OPENAI_API_KEY in the test environment (server/test/setup has none set),
    // so this exercises the honest "not configured yet" path rather than a mock.
    const text = await extractText(Buffer.from('fake-jpeg-bytes'), 'image/jpeg', 'scan.jpg');
    expect(text).toBe('');
  });

  it('never throws on malformed bytes claiming to be a PDF', async () => {
    const text = await extractText(Buffer.from('not a real pdf'), 'application/pdf', 'broken.pdf');
    expect(typeof text).toBe('string');
  });

  it('never throws on bytes an xlsx parser can\'t make sense of', async () => {
    // SheetJS is lenient — plain text parses as a one-cell CSV sheet, so this
    // uses bytes that match no format it auto-detects. The contract that
    // matters is "never throws", not a specific empty result.
    const garbage = Buffer.from([0x00, 0xff, 0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x00]);
    const text = await extractText(
      garbage,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'broken.xlsx',
    );
    expect(typeof text).toBe('string');
  });

  it('stores an unrecognized type searchable by name only (empty body text)', async () => {
    const text = await extractText(Buffer.from([1, 2, 3]), 'application/x-unknown', 'mystery.bin');
    expect(text).toBe('');
  });
});
