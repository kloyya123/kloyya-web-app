/**
 * The AI layer, one provider-neutral seam.
 *
 * Ask Kloyya doesn't know or care which model answers it — it hands a system
 * prompt and a few messages to an `AiProvider` and gets text back. Three
 * providers implement that contract over plain fetch (no SDK, so tests inject a
 * fake fetch exactly like the connectors do): OpenAI, Claude, and Perplexity.
 * `AI_PROVIDER` selects which one a request uses.
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
  /** 'openai' | 'anthropic' | 'perplexity' — for logging, never a secret. */
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
  provider: 'openai' | 'anthropic' | 'perplexity';
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
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

/** OpenAI chat completions. The system prompt rides as the first message. */
function openaiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'openai',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      const response = await doFetch(OPENAI_URL, {
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
      });

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
      const response = await doFetch(ANTHROPIC_URL, {
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
      });

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
      const response = await doFetch(PERPLEXITY_URL, {
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
      });

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
 * The configured provider, or null when the selected one has no key.
 *
 * Null is not an error — it is the honest "AI isn't set up here" state, and the
 * caller renders it as such. Only a configured-but-failing provider throws, and
 * that happens at call time, not here.
 */
export function resolveAiProvider(config: ProviderConfig): AiProvider | null {
  if (config.provider === 'anthropic') {
    return config.anthropicApiKey
      ? anthropicProvider(config.anthropicApiKey, config.anthropicModel)
      : null;
  }
  if (config.provider === 'perplexity') {
    return config.perplexityApiKey
      ? perplexityProvider(config.perplexityApiKey, config.perplexityChatModel)
      : null;
  }
  return config.openaiApiKey ? openaiProvider(config.openaiApiKey, config.openaiModel) : null;
}
