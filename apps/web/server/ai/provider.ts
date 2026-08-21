/**
 * The AI layer, one provider-neutral seam.
 *
 * Ask Kloyya doesn't know or care which model answers it — it hands a system
 * prompt and a few messages to an `AiProvider` and gets text back. Five
 * providers implement that contract over plain fetch (no SDK, so tests inject a
 * fake fetch exactly like the connectors do): OpenAI, Claude, Perplexity,
 * NVIDIA, and Hugging Face's inference router. `AI_PROVIDER` names the
 * preferred one; see `resolveAiProvider` below for how the rest act as
 * automatic fallback rather than requiring a manual switch.
 *
 * Perplexity appears here as well as in server/ask/web-search.ts, and the two
 * roles are deliberately opposite. There it is the RESEARCHER and search is the
 * whole point; here it is the AUTHOR reasoning over evidence already gathered,
 * so search is switched off. Same vendor, same key, contradictory settings —
 * which is why they are separate seams with separate model settings rather than
 * one shared client.
 *
 * The whole thing degrades honestly: with no key for the selected provider,
 * `resolveAiProvider` returns null and the caller shows a "not configured" state
 * rather than throwing. A provider that is configured but unreachable throws
 * `AiError`, which the route turns into a 503 — the connection is fine, the model
 * host isn't.
 */

export type AiRole = 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface CompleteParams {
  /** The instruction that frames the whole exchange. */
  system: string;
  messages: AiMessage[];
  /** Upper bound on the reply length. Providers cap their own way. */
  maxTokens?: number;
  /** Injectable so tests never touch the network. */
  fetchImpl?: typeof fetch;
}

export interface AiProvider {
  /** 'openai' | 'anthropic' | 'perplexity' | 'nvidia' | 'huggingface' — for logging, never a secret. */
  readonly name: string;
  /** The concrete model id in use. */
  readonly model: string;
  complete(params: CompleteParams): Promise<{ text: string }>;
}

/** The model host refused or was unreachable. Transient — worth a retry, not a fix. */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'perplexity' | 'nvidia' | 'huggingface';
  openaiApiKey?: string | undefined;
  openaiModel: string;
  anthropicApiKey?: string | undefined;
  anthropicModel: string;
  perplexityApiKey?: string | undefined;
  /**
   * Named `Chat` to keep it apart from the `PERPLEXITY_MODEL` that web search
   * uses. Same vendor, same key, two different jobs — and wiring the search
   * model in here would silently work while being the wrong knob to turn.
   */
  perplexityChatModel: string;
  nvidiaApiKey?: string | undefined;
  nvidiaModel: string;
  huggingfaceApiKey?: string | undefined;
  huggingfaceModel: string;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const HUGGINGFACE_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Every provider call gets a hard deadline well under Vercel's 60s function
 * limit (see `maxDuration` on each route that calls this). Left unbounded, a
 * slow model host runs the request out past the platform's own timeout,
 * which kills the function mid-flight and hands the browser a non-JSON
 * response it can't parse — the "Kloyya received a response it could not
 * read" failure. Timing out here instead means our own code is still the one
 * answering, with a clean `AiError` the route turns into real JSON.
 */
const PROVIDER_TIMEOUT_MS = 45_000;

/** Wraps a provider's fetch with the shared deadline above. */
async function timedFetch(
  doFetch: typeof fetch,
  url: string,
  init: RequestInit,
  providerName: string,
): Promise<Response> {
  try {
    return await doFetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AiError(`${providerName} did not respond within ${PROVIDER_TIMEOUT_MS / 1000}s.`);
    }
    throw error;
  }
}

/** OpenAI chat completions. The system prompt rides as the first message. */
function openaiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'openai',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await timedFetch(
        doFetch,
        OPENAI_URL,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages: [
              { role: 'system', content: params.system },
              ...params.messages,
            ],
          }),
        },
        'OpenAI',
      );

      if (!response.ok) {
        // Never echo the body — it can carry the prompt and, on some errors, the
        // key we sent. The status is enough to act on.
        throw new AiError(`OpenAI request failed (HTTP ${response.status}).`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new AiError('OpenAI returned no message.');
      return { text };
    },
  };
}

/** Anthropic messages. The system prompt is its own field, not a message. */
function anthropicProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'anthropic',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await timedFetch(
        doFetch,
        ANTHROPIC_URL,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            system: params.system,
            messages: params.messages,
          }),
        },
        'Anthropic',
      );

      if (!response.ok) {
        throw new AiError(`Anthropic request failed (HTTP ${response.status}).`);
      }

      const body = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };
      const text = body.content?.find((block) => block.type === 'text')?.text;
      if (typeof text !== 'string') throw new AiError('Anthropic returned no text.');
      return { text };
    },
  };
}

/**
 * Remove citation markers like `[1]` or `[3][7]` from an answer.
 *
 * Kloyya's citations are assembled by the pipeline from records it actually
 * retrieved — a number the model writes into its prose refers to a list only the
 * model saw, so it renders as a footnote pointing at nothing. That is worse than
 * no citation at all, because it reads as sourced.
 *
 * Bounded to one or two digits on purpose: a bare `\d+` would also eat a year in
 * brackets, and "[2024]" is a plausible thing for an answer to contain.
 */
export function stripFootnoteMarkers(text: string): string {
  return text
    .replace(/\[\d{1,2}\]/g, '')
    // Tidy the gaps the markers leave: " ." and doubled spaces.
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Perplexity Sonar, used here as a plain chat model rather than a search engine.
 *
 * `disable_search` is the load-bearing line. Measured against the live API with
 * Kloyya's own grounding prompt: left at its default, Sonar ran a web search
 * anyway, answered partly from what it found, and footnoted the result `[1][3]`
 * — outside knowledge presented as though it came from the user's workspace,
 * which is the one thing this product must never do. With search off, the same
 * prompt correctly answered "I couldn't find that in your connected tools."
 *
 * Note `enable_search: false` is NOT the same thing — the API accepts it,
 * ignores it, and still searches. It is the more obvious spelling and the wrong
 * one, so it is worth knowing before someone "tidies" this.
 */
function perplexityProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'perplexity',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await timedFetch(
        doFetch,
        PERPLEXITY_URL,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            disable_search: true,
            // OpenAI-compatible shape: the system prompt is the first message.
            messages: [{ role: 'system', content: params.system }, ...params.messages],
          }),
        },
        'Perplexity',
      );

      if (!response.ok) {
        throw new AiError(`Perplexity request failed (HTTP ${response.status}).`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new AiError('Perplexity returned no message.');
      // Belt and braces: search is off, but the habit of footnoting is trained in.
      return { text: stripFootnoteMarkers(text) };
    },
  };
}

/**
 * Extra `max_tokens` headroom reserved for `openai/gpt-oss-120b`'s internal
 * reasoning trace on NVIDIA's hosted endpoint.
 *
 * This model is a "reasoning" model: it spends tokens thinking in a separate
 * `reasoning_content` field BEFORE writing anything into `message.content`,
 * and both draw from the same `max_tokens` budget. Measured against the live
 * API: a two-word answer to "say hi" alone burned 46 tokens on reasoning —
 * every caller in this codebase requests 200-900, all comfortably below
 * that, so every one of them got `content: null` (the budget ran out mid-
 * thought) and read as a total failure. This is added on top of whatever the
 * caller asked for, so their intended answer-length budget is preserved.
 *
 * Kept as a safety net alongside `reasoning_effort: 'low'` below, not instead
 * of it — if NVIDIA's endpoint ever ignores that field, this still stops the
 * null-content failure; it just costs more latency doing it.
 */
const NVIDIA_REASONING_HEADROOM = 1500;

/**
 * NVIDIA's hosted inference API — OpenAI-compatible, so the request/response
 * shape is identical to `openaiProvider`; only the base URL, key, and model
 * differ, plus the reasoning-budget handling above. Kept as its own function
 * rather than a parameterized "OpenAI-shaped" helper, matching how
 * `perplexityProvider` also reuses the same wire shape — each vendor's own
 * quirks have somewhere to live without reaching into a shared function's
 * internals.
 *
 * `reasoning_effort: 'low'` (a gpt-oss-specific field NVIDIA's endpoint
 * passes through) is the actual fix for this model's latency, not just its
 * token budget: left at its default, "say hi" with a 600-token ceiling took
 * 37.6s end to end on the live API — comfortably able to blow past every
 * route's `maxDuration` once real questions need real reasoning. Low effort
 * cuts how much the model thinks before answering.
 */
function nvidiaProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'nvidia',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await timedFetch(
        doFetch,
        NVIDIA_URL,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: (params.maxTokens ?? DEFAULT_MAX_TOKENS) + NVIDIA_REASONING_HEADROOM,
            reasoning_effort: 'low',
            messages: [
              { role: 'system', content: params.system },
              ...params.messages,
            ],
          }),
        },
        'NVIDIA',
      );

      if (!response.ok) {
        throw new AiError(`NVIDIA request failed (HTTP ${response.status}).`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[];
      };
      // Fall back to the reasoning trace itself if the final answer never got
      // written — a truncated-but-real answer beats treating this as a total
      // failure, and the reasoning trace's own final sentence is usually it.
      const text =
        body.choices?.[0]?.message?.content ?? body.choices?.[0]?.message?.reasoning_content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError('NVIDIA returned no message.');
      }
      return { text };
    },
  };
}

/**
 * Hugging Face's inference router — one endpoint in front of many hosted
 * open-weight models (DeepSeek, Kimi, and others), picked by prefixing the
 * model id with its serving provider, e.g. `deepseek-ai/DeepSeek-V4-Flash:novita`.
 * OpenAI-compatible request/response shape, same as NVIDIA's.
 */
function huggingfaceProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'huggingface',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await timedFetch(
        doFetch,
        HUGGINGFACE_URL,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages: [
              { role: 'system', content: params.system },
              ...params.messages,
            ],
          }),
        },
        'Hugging Face',
      );

      if (!response.ok) {
        throw new AiError(`Hugging Face request failed (HTTP ${response.status}).`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new AiError('Hugging Face returned no message.');
      return { text };
    },
  };
}

function providerFor(config: ProviderConfig, name: ProviderConfig['provider']): AiProvider | null {
  switch (name) {
    case 'anthropic':
      return config.anthropicApiKey
        ? anthropicProvider(config.anthropicApiKey, config.anthropicModel)
        : null;
    case 'openai':
      return config.openaiApiKey ? openaiProvider(config.openaiApiKey, config.openaiModel) : null;
    case 'nvidia':
      return config.nvidiaApiKey ? nvidiaProvider(config.nvidiaApiKey, config.nvidiaModel) : null;
    case 'huggingface':
      return config.huggingfaceApiKey
        ? huggingfaceProvider(config.huggingfaceApiKey, config.huggingfaceModel)
        : null;
    case 'perplexity':
      return config.perplexityApiKey
        ? perplexityProvider(config.perplexityApiKey, config.perplexityChatModel)
        : null;
  }
}

/**
 * Quality-ordered fallback, most capable general-purpose reasoner first.
 * Perplexity sits last on purpose: per `perplexityProvider`'s own docs it is
 * being used off-label here (a search model with search forced off), so it is
 * the least suited of the group to be reasoning over evidence when a real
 * choice exists.
 */
const FALLBACK_ORDER: ProviderConfig['provider'][] = [
  'anthropic',
  'openai',
  'nvidia',
  'huggingface',
  'perplexity',
];

/**
 * The best available provider — preferred first, then the rest of
 * `FALLBACK_ORDER` — wrapped so a failure at CALL TIME also falls through,
 * not just a missing key at resolve time.
 *
 * That distinction matters: a key that exists but is out of credit, revoked,
 * or hitting the host's own rate limit looks identical to "configured" here —
 * the difference only shows up once `.complete()` actually runs and the
 * provider answers with an error. Stopping at the first configured provider,
 * the way this used to work, meant one exhausted OpenAI key took down Ask
 * Kloyya even with a perfectly good Anthropic or NVIDIA key sitting unused
 * right next to it. Now every configured provider gets one attempt, in
 * order, before the caller sees a failure — "switching to the best model[s]"
 * happens on every request, not just at deploy time.
 *
 * `name`/`model` on the returned object reflect whichever provider actually
 * answered on the LAST attempt (updated as `complete()` runs), since that is
 * what the caller should log — not a static guess made before the request.
 *
 * Null only when NONE of the five have a key at all — the honest "AI isn't
 * set up here" state, which the caller renders as such.
 */
export function resolveAiProvider(config: ProviderConfig): AiProvider | null {
  const order: ProviderConfig['provider'][] = [
    config.provider,
    ...FALLBACK_ORDER.filter((name) => name !== config.provider),
  ];
  const providers = order
    .map((name) => providerFor(config, name))
    .filter((provider): provider is AiProvider => provider !== null);

  if (providers.length === 0) return null;

  const state = { name: providers[0]!.name, model: providers[0]!.model };

  return {
    get name() {
      return state.name;
    },
    get model() {
      return state.model;
    },
    async complete(params) {
      let lastError: unknown;
      for (const provider of providers) {
        try {
          const result = await provider.complete(params);
          state.name = provider.name;
          state.model = provider.model;
          return result;
        } catch (error) {
          lastError = error;
          // Try the next configured provider. AiError and anything else
          // (a network throw, a JSON parse failure) are both worth a
          // fallback attempt — the point is resilience, not diagnosing
          // which vendor is at fault.
        }
      }
      throw lastError instanceof AiError
        ? lastError
        : new AiError('Every configured AI provider failed.');
    },
  };
}
