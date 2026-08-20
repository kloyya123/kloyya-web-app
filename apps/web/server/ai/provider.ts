export type AiRole = 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface CompleteParams {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export interface AiProvider {
  readonly name: 'perplexity';
  readonly model: string;
  complete(params: CompleteParams): Promise<{ text: string }>;
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export interface ProviderConfig {
  provider: 'perplexity';
  perplexityApiKey?: string | undefined;
  perplexityModel?: string | undefined;
}

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Perplexity Sonar provider.
 *
 * Perplexity exposes an OpenAI-compatible chat completions
 * endpoint, so the request format stays very small.
 */
function perplexityProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'perplexity',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;

      let response: Response;
      try {
        response = await doFetch(PERPLEXITY_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
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
      } catch {
        // Network-level failure (DNS, timeout, connection reset) —
        // distinct from an HTTP error response below.
        throw new AiError('Perplexity request failed.');
      }

      if (!response.ok) {
        throw new AiError(
          `Perplexity request failed (HTTP ${response.status}).`,
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError('Perplexity returned no message.');
      }

      return { text };
    },
  };
}

/**
 * Resolve the configured AI provider.
 *
 * Kloyya uses Perplexity Sonar only (see config.ts:
 * AI_PROVIDER is a fixed literal). If the API key is missing,
 * return null so the caller can report "AI not configured"
 * instead of crashing.
 */
export function resolveAiProvider(
  config: ProviderConfig,
): AiProvider | null {
  if (config.provider !== 'perplexity') {
    return null;
  }
  if (!config.perplexityApiKey || !config.perplexityModel) {
    return null;
  }
  return perplexityProvider(config.perplexityApiKey, config.perplexityModel);
}