/**
 * Provider AI unique de Kloyya.
 *
 * Kloyya utilise Perplexity Sonar.
 * La clé API reste uniquement côté serveur.
 */

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
  readonly name: string;
  readonly model: string;

  complete(
    params: CompleteParams,
  ): Promise<{ text: string }>;
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
  perplexityModel: string;
}

const PERPLEXITY_URL =
  'https://api.perplexity.ai/chat/completions';

const DEFAULT_MAX_TOKENS = 1024;

/**
 * Perplexity Sonar provider.
 */
function perplexityProvider(
  apiKey: string,
  model: string,
): AiProvider {
  return {
    name: 'perplexity',
    model,

    async complete(params) {
      const doFetch =
        params.fetchImpl ?? fetch;

      const response = await doFetch(
        PERPLEXITY_URL,
        {
          method: 'POST',

          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type':
              'application/json',
          },

          body: JSON.stringify({
            model,

            max_tokens:
              params.maxTokens ??
              DEFAULT_MAX_TOKENS,

            messages: [
              {
                role: 'system',
                content: params.system,
              },
              ...params.messages,
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new AiError(
          `Perplexity request failed (HTTP ${response.status}).`,
        );
      }

      const body =
        (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

      const text =
        body.choices?.[0]?.message?.content;

      if (typeof text !== 'string') {
        throw new AiError(
          'Perplexity returned no message.',
        );
      }

      return { text };
    },
  };
}

/**
 * Resolve the configured AI provider.
 *
 * Kloyya uses Perplexity Sonar only.
 */
export function resolveAiProvider(
  config: ProviderConfig,
): AiProvider | null {
  if (config.provider !== 'perplexity') {
    return null;
  }

  if (!config.perplexityApiKey) {
    return null;
  }

  return perplexityProvider(
    config.perplexityApiKey,
    config.perplexityModel,
  );
}
