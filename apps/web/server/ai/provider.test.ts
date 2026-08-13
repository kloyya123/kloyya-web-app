import { describe, expect, it } from 'vitest';
import {
  AiError,
  resolveAiProvider,
  stripFootnoteMarkers,
  type ProviderConfig,
} from './provider';

/**
 * The provider seam. A fake fetch stands in for the model host; the cases that
 * matter are the ones a real key would otherwise be needed to exercise: each
 * provider speaks its own wire shape, a non-2xx is a transient AiError (never
 * a leaked body), a missing key resolves to null rather than throwing, and a
 * configured-but-failing provider falls through to the next one rather than
 * taking Ask Kloyya down.
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

/** Every provider configured, for resolveAiProvider's own selection/fallback tests. */
const base: ProviderConfig = {
  provider: 'openai',
  openaiApiKey: 'sk-test',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: 'ant-test',
  anthropicModel: 'claude-opus-4-8',
  perplexityApiKey: 'pplx-test',
  perplexityChatModel: 'sonar',
  nvidiaApiKey: 'nvapi-test',
  nvidiaModel: 'openai/gpt-oss-120b',
  huggingfaceApiKey: 'hf-test',
  huggingfaceModel: 'deepseek-ai/DeepSeek-V4-Flash:novita',
};

/** Exactly one key set, so a provider's own `.complete()` tests never trigger a fallback. */
function only(provider: ProviderConfig['provider']): ProviderConfig {
  return {
    provider,
    openaiApiKey: provider === 'openai' ? 'sk-test' : undefined,
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: provider === 'anthropic' ? 'ant-test' : undefined,
    anthropicModel: 'claude-opus-4-8',
    perplexityApiKey: provider === 'perplexity' ? 'pplx-test' : undefined,
    perplexityChatModel: 'sonar',
    nvidiaApiKey: provider === 'nvidia' ? 'nvapi-test' : undefined,
    nvidiaModel: 'openai/gpt-oss-120b',
    huggingfaceApiKey: provider === 'huggingface' ? 'hf-test' : undefined,
    huggingfaceModel: 'deepseek-ai/DeepSeek-V4-Flash:novita',
  };
}

describe('resolveAiProvider', () => {
  it('returns null when NO provider has a key', () => {
    expect(
      resolveAiProvider({
        provider: 'openai',
        openaiModel: 'gpt-4o-mini',
        anthropicModel: 'claude-opus-4-8',
        perplexityChatModel: 'sonar',
        nvidiaModel: 'openai/gpt-oss-120b',
        huggingfaceModel: 'deepseek-ai/DeepSeek-V4-Flash:novita',
      }),
    ).toBeNull();
  });

  it('selects the provider named by config when it has a key', () => {
    expect(resolveAiProvider(only('openai'))?.name).toBe('openai');
    expect(resolveAiProvider(only('anthropic'))?.name).toBe('anthropic');
    expect(resolveAiProvider(only('perplexity'))?.name).toBe('perplexity');
    expect(resolveAiProvider(only('nvidia'))?.name).toBe('nvidia');
    expect(resolveAiProvider(only('huggingface'))?.name).toBe('huggingface');
  });

  it('falls back to a configured provider when the preferred one has no key', () => {
    // openai is preferred but unconfigured; anthropic and perplexity are.
    const config: ProviderConfig = { ...only('anthropic'), provider: 'openai', perplexityApiKey: 'pplx-test' };
    expect(resolveAiProvider(config)?.name).toBe('anthropic');
  });

  it('falls through to the next configured provider when the preferred one fails at call time', async () => {
    // openai is preferred and has a key, but the host will refuse it (e.g. out
    // of credit) — anthropic is configured too and should answer instead.
    const provider = resolveAiProvider(base)!;
    let hitOpenai = false;
    let hitAnthropic = false;

    const fetchImpl: typeof fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes('api.openai.com')) {
        hitOpenai = true;
        return new Response(JSON.stringify({ error: 'insufficient_quota' }), { status: 429 });
      }
      if (url.includes('api.anthropic.com')) {
        hitAnthropic = true;
        return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Fallback answer.' }] }), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch to ${url}`);
    }) as unknown as typeof fetch;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl,
    });

    expect(text).toBe('Fallback answer.');
    expect(hitOpenai).toBe(true);
    expect(hitAnthropic).toBe(true);
    // The provider object reflects who actually answered, not who was preferred.
    expect(provider.name).toBe('anthropic');
  });

  it('throws AiError when every configured provider fails', async () => {
    const provider = resolveAiProvider(base)!;
    const error = await provider
      .complete({
        system: 's',
        messages: [{ role: 'user', content: 'q' }],
        fetchImpl: capture({ error: 'down' }, 503),
      })
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(AiError);
  });
});

describe('OpenAI provider', () => {
  it('sends the system prompt as the first message and reads the reply', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider(only('openai'))!;

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
    const provider = resolveAiProvider(only('openai'))!;
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
    const provider = resolveAiProvider(only('anthropic'))!;

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

describe('NVIDIA provider', () => {
  it('sends the system prompt as the first message and reads the reply, OpenAI-shaped', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider(only('nvidia'))!;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl: capture({ choices: [{ message: { content: 'Hello from NVIDIA.' } }] }, 200, (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    expect(text).toBe('Hello from NVIDIA.');
    expect(seenUrl).toContain('integrate.api.nvidia.com');
    expect((seenBody['messages'] as { role: string }[])[0]).toMatchObject({ role: 'system' });
  });

  it('asks for extra headroom on top of the caller\'s budget, for the reasoning trace', async () => {
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider(only('nvidia'))!;

    await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      maxTokens: 400,
      fetchImpl: capture({ choices: [{ message: { content: 'ok' } }] }, 200, (_url, init) => {
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    // 400 requested + the fixed reasoning headroom this provider adds.
    expect(seenBody['max_tokens']).toBe(400 + 1500);
  });

  it('falls back to the reasoning trace when the model never wrote a final answer', async () => {
    // openai/gpt-oss-120b, live: with too little budget, `content` comes back
    // null while `reasoning_content` holds real text — this is exactly the
    // shape that made every real Ask/briefing/summary call fail as "no
    // message" until the fallback below was added.
    const provider = resolveAiProvider(only('nvidia'))!;

    const { text } = await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      fetchImpl: capture({
        choices: [{ message: { content: null, reasoning_content: 'Probably "Hi".' } }],
      }),
    });

    expect(text).toBe('Probably "Hi".');
  });

  it('maps a non-2xx to a transient AiError without echoing the body', async () => {
    const provider = resolveAiProvider(only('nvidia'))!;
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

describe('Hugging Face provider', () => {
  it('sends the system prompt as the first message and reads the reply, OpenAI-shaped', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider(only('huggingface'))!;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl: capture({ choices: [{ message: { content: 'Hello from Hugging Face.' } }] }, 200, (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    expect(text).toBe('Hello from Hugging Face.');
    expect(seenUrl).toContain('router.huggingface.co');
    expect((seenBody['messages'] as { role: string }[])[0]).toMatchObject({ role: 'system' });
  });

  it('maps a non-2xx to a transient AiError without echoing the body', async () => {
    const provider = resolveAiProvider(only('huggingface'))!;
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

/**
 * Perplexity is the one provider whose defaults are actively wrong for this job:
 * it is a search engine being asked to stop searching. These tests pin the two
 * settings that make it safe, because both look removable to a passing reader.
 */
describe('Perplexity provider', () => {
  it('always disables search, so the answer cannot smuggle in the open web', async () => {
    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    const provider = resolveAiProvider(only('perplexity'))!;

    const { text } = await provider.complete({
      system: 'You are Kloyya.',
      messages: [{ role: 'user', content: 'Hi' }],
      fetchImpl: capture({ choices: [{ message: { content: 'Hello.' } }] }, 200, (url, init) => {
        seenUrl = url;
        seenBody = JSON.parse(String(init?.body));
      }),
    });

    expect(text).toBe('Hello.');
    expect(seenUrl).toContain('api.perplexity.ai');
    // Verified against the live API: without this, Sonar searches anyway and
    // footnotes the result, citing pages the user's citation list never saw.
    expect(seenBody['disable_search']).toBe(true);
    expect((seenBody['messages'] as { role: string }[])[0]).toMatchObject({ role: 'system' });
  });

  it('strips footnote markers out of the answer', async () => {
    const provider = resolveAiProvider(only('perplexity'))!;

    const { text } = await provider.complete({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      fetchImpl: capture({
        choices: [{ message: { content: 'Dana owns the migration [1][3]. Ask her [7].' } }],
      }),
    });

    expect(text).toBe('Dana owns the migration. Ask her.');
  });

  it('maps a non-2xx to a transient AiError without echoing the body', async () => {
    const provider = resolveAiProvider(only('perplexity'))!;
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

describe('stripFootnoteMarkers', () => {
  it('removes markers and closes the gaps they leave', () => {
    expect(stripFootnoteMarkers('See [1] for details.')).toBe('See for details.');
    expect(stripFootnoteMarkers('Shipped Tuesday [2].')).toBe('Shipped Tuesday.');
    expect(stripFootnoteMarkers('Three sources agree [1][2][3].')).toBe('Three sources agree.');
  });

  it('leaves a bracketed year alone', () => {
    // Why the pattern is bounded to two digits: a citation is never [2024], but
    // an answer quoting a document very plausibly is.
    expect(stripFootnoteMarkers('The [2024] filing.')).toBe('The [2024] filing.');
  });

  it('leaves markdown links intact', () => {
    const md = 'Read the [handbook](https://example.com/h).';
    expect(stripFootnoteMarkers(md)).toBe(md);
  });
});
