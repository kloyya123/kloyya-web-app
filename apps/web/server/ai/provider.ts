import 'server-only';

export type AiRole = 'user' | 'assistant';

export type AiProviderName = 'perplexity' | 'openai' | 'anthropic';

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

/**
 * Configuration used to resolve an AI provider.
 *
 * Both PERPLEXITY_API_KEY and the legacy CLE_SONAR_API_KLOYYA2
 * are supported for Perplexity.
 */
export interface ProviderConfig {
  provider: AiProviderName;

  perplexityApiKey?: string;
  perplexityModel?: string;

  openaiApiKey?: string;
  openaiModel?: string;

  anthropicApiKey?: string;
  anthropicModel?: string;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;

  complete(params: CompleteParams): Promise<{
    text: string;
  }>;
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const DEFAULT_MAX_TOKENS = 1024;

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function getMaxTokens(maxTokens?: number): number {
  if (maxTokens === undefined) {
    return DEFAULT_MAX_TOKENS;
  }

  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new AiError('Invalid maxTokens value.');
  }

  return Math.floor(maxTokens);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new AiError('AI provider returned an invalid JSON response.');
  }
}

function extractOpenAiCompatibleText(body: {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}): string | null {
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    return null;
  }

  const text = content.trim();

  return text.length > 0 ? text : null;
}

/* -------------------------------------------------------------------------- */
/* Perplexity                                                                */
/* -------------------------------------------------------------------------- */

function perplexityProvider(
  apiKey: string,
  model: string,
): AiProvider {
  return {
    name: 'perplexity',
    model,

    async complete(params): Promise<{ text: string }> {
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
            max_tokens: getMaxTokens(params.maxTokens),
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

      const body = await parseJsonResponse<{
        choices?: Array<{
          message?: {
            content?: unknown;
          };
        }>;
      }>(response);

      const text = extractOpenAiCompatibleText(body);

      if (!text) {
        throw new AiError(
          'Perplexity returned no message.',
        );
      }

      return { text };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* OpenAI                                                                     */
/* -------------------------------------------------------------------------- */

function openaiProvider(
  apiKey: string,
  model: string,
): AiProvider {
  return {
    name: 'openai',
    model,

    async complete(params): Promise<{ text: string }> {
      const doFetch = params.fetchImpl ?? fetch;

      let response: Response;

      try {
        response = await doFetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: getMaxTokens(params.maxTokens),
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
        throw new AiError('OpenAI request failed.');
      }

      if (!response.ok) {
        throw new AiError(
          `OpenAI request failed (HTTP ${response.status}).`,
        );
      }

      const body = await parseJsonResponse<{
        choices?: Array<{
          message?: {
            content?: unknown;
          };
        }>;
      }>(response);

      const text = extractOpenAiCompatibleText(body);

      if (!text) {
        throw new AiError(
          'OpenAI returned no message.',
        );
      }

      return { text };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Anthropic                                                                  */
/* -------------------------------------------------------------------------- */

function anthropicProvider(
  apiKey: string,
  model: string,
): AiProvider {
  return {
    name: 'anthropic',
    model,

    async complete(params): Promise<{ text: string }> {
      const doFetch = params.fetchImpl ?? fetch;

      let response: Response;

      try {
        response = await doFetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: getMaxTokens(params.maxTokens),
            system: params.system,
            messages: params.messages,
          }),
        });
      } catch {
        throw new AiError('Anthropic request failed.');
      }

      if (!response.ok) {
        throw new AiError(
          `Anthropic request failed (HTTP ${response.status}).`,
        );
      }

      const body = await parseJsonResponse<{
        content?: Array<{
          type?: unknown;
          text?: unknown;
        }>;
      }>(response);

      const text = body.content?.find(
        (item) =>
          item.type === 'text' &&
          typeof item.text === 'string' &&
          item.text.trim().length > 0,
      )?.text;

      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError(
          'Anthropic returned no message.',
        );
      }

      return {
        text: text.trim(),
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Provider resolver                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the configured AI provider.
 *
 * Perplexity supports both:
 *
 *   PERPLEXITY_API_KEY
 *
 * and the current Vercel environment variable:
 *
 *   CLE_SONAR_API_KLOYYA2
 *
 * The latter is intentionally supported so you do NOT have to rename
 * your existing production secret immediately.
 */
export function resolveAiProvider(
  config: ProviderConfig,
): AiProvider | null {
  switch (config.provider) {
    case 'perplexity': {
      const apiKey = config.perplexityApiKey;

      if (!apiKey || !config.perplexityModel) {
        return null;
      }

      return perplexityProvider(
        apiKey,
        config.perplexityModel,
      );
    }

    case 'openai': {
      if (!config.openaiApiKey || !config.openaiModel) {
        return null;
      }

      return openaiProvider(
        config.openaiApiKey,
        config.openaiModel,
      );
    }

    case 'anthropic': {
      if (!config.anthropicApiKey || !config.anthropicModel) {
        return null;
      }

      return anthropicProvider(
        config.anthropicApiKey,
        config.anthropicModel,
      );
    }

    default:
      return null;
  }
}
