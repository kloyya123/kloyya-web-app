import { config } from '@server/config';

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

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MAX_TOKENS = 1024;

function perplexityProvider(
  apiKey: string,
  model: string,
): AiProvider {
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
              {
                role: 'system',
                content: params.system,
              },
              ...params.messages,
            ],
          }),
        });
      } catch {
        throw new AiError('Perplexity request failed.');
      }

      if (!response.ok) {
        throw new AiError(
          `Perplexity request failed (HTTP ${response.status}).`,
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const text = body.choices?.[0]?.message?.content;

      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError('Perplexity returned no message.');
      }

      return {
        text,
      };
    },
  };
}

export function resolveAiProvider(config: {
  provider: 'perplexity';
  perplexityApiKey?: string;
  perplexityModel: string;
}): AiProvider | null {
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
