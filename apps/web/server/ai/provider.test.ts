import { describe, expect, it } from 'vitest';
import { AiError, resolveAiProvider, type ProviderConfig } from './provider';

/**
 * The provider seam. A fake fetch stands in for the model host; the cases that
 * matter are the ones a real key would otherwise be needed to exercise: the two
 * providers speak their own wire shapes, a non-2xx is a transient AiError (never
 * a leaked body), and a missing key resolves to null rather than throwing.
 */
const capture = (
  body: unknown,
  status = 200,
  seen?: (url: string, init: RequestInit | undefined) => void,
): typeof fetch =>
  (async (input: string | URL, init?: RequestInit) => {
    seen?.(String(input), init);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;

const base: ProviderConfig = {
  provider: 'openai',
  openaiApiKey: 'sk-test',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: 'ant-test',
  anthropicModel: 'claude-opus-4-8',
};

describe('resolveAiProvider', () => {
  it('returns null when the selected provider has no key', () => {
    expect(resolveAiProvider({ ...base, provider: 'openai', openaiApiKey: undefined })).toBeNull();
    expect(
      resolveAiProvider({ ...base, provider: 'anthropic', anthropicApiKey: undefined }),
    ).toBeNull();
  });

  it('selects the provider named by config', () => {
    expect(resolveAiProvider({ ...base, provider: 'openai' })?.name).toBe('openai');
    expect(resolveAiProvider({ ...base, provider: 'anthropic' })?.name).toBe('anthropic');
  });
});

describe('OpenAI provider', () => {
  it('sends the system prompt as the first message and reads the reply', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider({ ...base, provider: 'openai' })!;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl: capture({ choices: [{ message: { content: 'Hello.' } }] }, 200, (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    expect(text).toBe('Hello.');
    expect(seenUrl).toContain('api.openai.com');
    expect((seenBody['messages'] as { role: string }[])[0]).toMatchObject({ role: 'system' });
  });

  it('maps a non-2xx to a transient AiError without echoing the body', async () => {
    const provider = resolveAiProvider({ ...base, provider: 'openai' })!;
    const error = await provider
      .complete({
        system: 's',
        messages: [{ role: 'user', content: 'secret question' }],
        fetchImpl: capture({ error: 'the prompt echoed back' }, 429),
      })
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(String(error)).not.toContain('secret question');
    expect(String(error)).not.toContain('the prompt echoed back');
  });
});

describe('Anthropic provider', () => {
  it('sends system as its own field and reads the first text block', async () => {
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider({ ...base, provider: 'anthropic' })!;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl: capture({ content: [{ type: 'text', text: 'Hey there.' }] }, 200, (_url, init) => {
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    expect(text).toBe('Hey there.');
    // Anthropic carries the system prompt outside the messages array.
    expect(seenBody['system']).toBe('You are Kloyya.');
    expect((seenBody['messages'] as unknown[]).length).toBe(1);
  });
});
