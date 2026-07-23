/**
 * The AI layer, one provider-neutral seam.
 *
 * Ask Kloyya doesn't know or care which model answers it — it hands a system
 * prompt and a few messages to an `AiProvider` and gets text back. Two providers
 * implement that contract over plain fetch (no SDK, so tests inject a fake fetch
 * exactly like the connectors do): OpenAI is the beta default, Claude is kept
 * available, and `AI_PROVIDER` selects which one a request uses.
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
  /** 'openai' | 'anthropic' — for logging and citations, never a secret. */
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
  provider: 'openai' | 'anthropic';
  openaiApiKey?: string | undefined;
  openaiModel: string;
  anthropicApiKey?: string | undefined;
  anthropicModel: string;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
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
  return config.openaiApiKey ? openaiProvider(config.openaiApiKey, config.openaiModel) : null;
}
