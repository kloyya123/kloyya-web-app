import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveWebSearch } from './web-search';

/**
 * The adapter against a REAL Perplexity response, captured from the live API.
 *
 * The other tests use hand-written mocks, which only prove the adapter handles
 * the shape I believed the API returns. This one proves it handles the shape it
 * actually returns — the difference that usually bites on first contact.
 */
describe('Perplexity adapter, against a captured live response', () => {
  const real = JSON.parse(readFileSync('pplx-fixture.json', 'utf8')) as unknown;

  const provider = resolveWebSearch({
    perplexityApiKey: 'test',
    fetchImpl: (async () => ({
      ok: true,
      status: 200,
      json: async () => real,
    })) as unknown as typeof fetch,
  });

  it('extracts citable sources from the live payload', async () => {
    const results = await provider!.search('What is Anthropic Claude?');

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.title.length).toBeGreaterThan(0);
    }
  });

  it('caps how much reaches the model', async () => {
    // The live call returned 21 sources; only a handful should ever be spent
    // on context, and the tail of a search is where the weak sources are.
    const results = await provider!.search('q');
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it('does not leak Sonar’s synthesised prose into the evidence', async () => {
    const results = await provider!.search('q');
    const prose = (real as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
      ?.content;

    expect(typeof prose).toBe('string');
    expect(prose!.length).toBeGreaterThan(50);
    // The whole design decision, verified against a real answer body.
    expect(JSON.stringify(results)).not.toContain(prose!.slice(0, 40));
  });
});
