import { describe, expect, it } from 'vitest';
import { resolveAiProvider } from '../ai/provider';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import { ask } from './service';
import { resolveWebSearch, searchWeb } from './web-search';

/**
 * END-TO-END against the REAL Perplexity and OpenAI APIs. No mocks.
 *
 * Everything else in this suite proves the adapter parses a payload. This
 * proves the whole pipeline works when pointed at the live internet: search
 * runs, results are fenced, the model reasons over them, and the answer comes
 * back with web citations that carry real URLs.
 *
 * Costs real API calls, so it is opt-in: run with LIVE_AI=1.
 */
const RUN = process.env['LIVE_AI'] === '1';

describe.skipIf(!RUN)('Ask Kloyya, live against real providers', () => {
  it('reaches the real Perplexity API and returns citable sources', async () => {
    // Isolated from the AI provider on purpose: when Ask Kloyya fails, this
    // says whether search or the model was at fault, without guessing.
    const webSearch = resolveWebSearch({ perplexityApiKey: process.env['PERPLEXITY_API_KEY'] });
    expect(webSearch?.name).toBe('perplexity');

    const results = await searchWeb(webSearch, 'What is an AI chief of staff?');
    console.log('--- LIVE PERPLEXITY RESULTS ---');
    for (const r of results) console.log(`  ${r.title} — ${r.url}`);

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.url).toMatch(/^https?:\/\//);
  }, 30_000);

  it('answers an external question using real web sources', async () => {
    const { db } = await createTestDb();
    const identity = await createTestIdentity(db, { email: 'live@example.com' });
    const ctx = await startContextFor(db, identity);

    const provider = resolveAiProvider({
      provider:
        (process.env['AI_PROVIDER'] as 'openai' | 'anthropic' | 'perplexity') ?? 'perplexity',
      openaiApiKey: process.env['OPENAI_API_KEY'],
      openaiModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
      anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
      anthropicModel: process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-4-8',
      perplexityApiKey: process.env['PERPLEXITY_API_KEY'],
      perplexityChatModel: process.env['PERPLEXITY_CHAT_MODEL'] ?? 'sonar',
    });
    expect(provider, 'no AI provider configured').not.toBeNull();

    const webSearch = resolveWebSearch({ perplexityApiKey: process.env['PERPLEXITY_API_KEY'] });
    expect(webSearch?.name, 'Perplexity not configured').toBe('perplexity');

    // Workspace is empty AND the question is plainly external, so this must
    // take the web branch — exactly the path that was never exercised live.
    const outcome = await ask(
      db,
      ctx,
      'What is the latest news about AI assistants for knowledge work?',
      provider,
      undefined,
      webSearch,
    );

    expect(outcome.ok, `ask failed: ${JSON.stringify(outcome)}`).toBe(true);
    if (!outcome.ok) return;

    const webCitations = outcome.result.citations.filter((c) => c.origin === 'web');

    console.log('\n--- ANSWER ---\n' + outcome.result.answer);
    console.log('\n--- CITATIONS ---');
    for (const c of outcome.result.citations) {
      console.log(`  [${c.origin}] ${c.source} — ${c.label}${c.url ? ` (${c.url})` : ''}`);
    }
    console.log(`\nmodel: ${outcome.result.model}`);

    // The whole point: real external evidence, each item actually checkable.
    expect(webCitations.length).toBeGreaterThan(0);
    for (const c of webCitations) {
      expect(c.url).toMatch(/^https?:\/\//);
      expect(c.origin).toBe('web');
    }
    expect(outcome.result.answer.length).toBeGreaterThan(40);
  }, 90_000);
});
