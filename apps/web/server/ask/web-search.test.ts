import { describe, expect, it, vi } from 'vitest';
import { resolveWebSearch, searchWeb, shouldSearchWeb, type WebSearchProvider } from './web-search';

/**
 * The web is the least trustworthy source Kloyya reads, so these tests care
 * about restraint and failure as much as about results: does it stay out of the
 * way when the workspace can answer, and does it get out of the way when the
 * provider misbehaves.
 */
describe('shouldSearchWeb', () => {
  it('searches when the workspace turned up almost nothing', () => {
    expect(shouldSearchWeb('what did Dana say about hiring?', 0)).toBe(true);
    expect(shouldSearchWeb('what did Dana say about hiring?', 1)).toBe(true);
  });

  it('stays inside the workspace when it has real coverage', () => {
    // The ordinary case, and the reason most questions never leave the building.
    expect(shouldSearchWeb('what did Dana say about hiring?', 8)).toBe(false);
    expect(shouldSearchWeb('summarise my meeting notes', 5)).toBe(false);
  });

  it('goes outside for questions plainly about the world, even with coverage', () => {
    for (const question of [
      'who are our competitors in this market?',
      'what is the latest news on this?',
      'how do I configure this in the documentation?',
      'compare these two approaches',
      'what are the regulations here?',
    ]) {
      expect(shouldSearchWeb(question, 8), question).toBe(true);
    }
  });

  it('does not mistake a newsletter for news', () => {
    // Whole-word matching: substrings would send half the inbox to the web.
    expect(shouldSearchWeb('summarise my newsletters', 8)).toBe(false);
  });

  it('goes outside when explicitly asked to, even with full workspace coverage', () => {
    for (const question of [
      'can you google this for me?',
      'check youtube for a demo of this',
      'find this online',
      'search the web for their pricing page',
      'look this up for me',
    ]) {
      expect(shouldSearchWeb(question, 8), question).toBe(true);
    }
  });

  it('treats a handful of keyword-matched records as still-thin coverage', () => {
    // A full-text match on the question's keywords isn't the same as an
    // answer — erring toward search here is deliberate, see THIN_WORKSPACE_THRESHOLD.
    expect(shouldSearchWeb('what did Dana say about hiring?', 2)).toBe(true);
  });
});

describe('resolveWebSearch', () => {
  it('is off when no key is configured', () => {
    // The feature ships dark: no key means Ask Kloyya behaves exactly as it did
    // before web search existed, rather than erroring.
    expect(resolveWebSearch({})).toBeNull();
  });

  it('prefers Perplexity when both keys are present', () => {
    const provider = resolveWebSearch({ perplexityApiKey: 'p', tavilyApiKey: 't' });
    expect(provider?.name).toBe('perplexity');
  });

  it('falls back to Tavily when only that key is set', () => {
    expect(resolveWebSearch({ tavilyApiKey: 't' })?.name).toBe('tavily');
  });
});

describe('searchWeb', () => {
  it('returns nothing when search is switched off', async () => {
    expect(await searchWeb(null, 'anything')).toEqual([]);
  });

  it('swallows a provider failure rather than failing the answer', async () => {
    const failing: WebSearchProvider = {
      name: 'broken',
      async search() {
        throw new Error('provider down');
      },
    };
    // The workspace can still answer; a search outage must not become an error
    // the user sees instead of their answer.
    await expect(searchWeb(failing, 'question')).resolves.toEqual([]);
  });

  it('passes results through when the provider works', async () => {
    const working: WebSearchProvider = {
      name: 'test',
      async search() {
        return [{ title: 'A page', url: 'https://example.com/a', content: 'Some evidence.' }];
      },
    };
    const results = await searchWeb(working, 'question');
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://example.com/a');
  });
});

describe('Perplexity adapter', () => {
  function respond(payload: unknown) {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });
  }

  it('keeps the sources and discards the synthesised prose', async () => {
    // The whole design decision: Sonar is the researcher, not the author. Its
    // answer text must never reach Kloyya's context as an unattributed claim.
    const fetchImpl = respond({
      choices: [{ message: { content: 'A confident essay we must not use.' } }],
      search_results: [
        { title: 'Official docs', url: 'https://docs.example.com/x', snippet: 'The real evidence.' },
      ],
    });
    const provider = resolveWebSearch({
      perplexityApiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const results = await provider!.search('question');
    expect(results).toEqual([
      { title: 'Official docs', url: 'https://docs.example.com/x', content: 'The real evidence.' },
    ]);
    expect(JSON.stringify(results)).not.toContain('confident essay');
  });

  it('falls back to bare citation URLs, and says the excerpt is missing', async () => {
    const fetchImpl = respond({ citations: ['https://www.example.com/page'] });
    const provider = resolveWebSearch({
      perplexityApiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const results = await provider!.search('question');
    expect(results[0]?.url).toBe('https://www.example.com/page');
    // Labelled by hostname, and honest that no content came back — so the model
    // cannot invent what the page said.
    expect(results[0]?.title).toBe('example.com');
    expect(results[0]?.content).toContain('no excerpt');
  });

  it('drops a result that cannot be cited', async () => {
    // A claim with no URL is unverifiable, which is worse than no claim.
    const fetchImpl = respond({
      search_results: [
        { title: 'No link', snippet: 'trust me' },
        { title: 'Real', url: 'https://example.com/ok', snippet: 'checkable' },
      ],
    });
    const provider = resolveWebSearch({
      perplexityApiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const results = await provider!.search('question');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Real');
  });

  it('throws on a provider error so searchWeb can convert it to no results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const provider = resolveWebSearch({
      perplexityApiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(provider!.search('question')).rejects.toThrow(/429/);
  });
});
