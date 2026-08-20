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
  readonly name: 'perplexity' | 'openai' | 'anthropic';
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
            messages: [{ role: 'system', content: params.system }, ...params.messages],
          }),
        });
      } catch {
        throw new AiError('Perplexity request failed.');
      }
      if (!response.ok) {
        throw new AiError(`Perplexity request failed (HTTP ${response.status}).`);
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

function openaiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'openai',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await doFetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages: [{ role: 'system', content: params.system }, ...params.messages],
          }),
        });
      } catch {
        throw new AiError('OpenAI request failed.');
      }
      if (!response.ok) {
        throw new AiError(`OpenAI request failed (HTTP ${response.status}).`);
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError('OpenAI returned no message.');
      }
      return { text };
    },
  };
}

function anthropicProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'anthropic',
    model,
    async complete(params) {
      const doFetch = params.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await doFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
            system: params.system,
            messages: params.messages,
          }),
        });
      } catch {
        throw new AiError('Anthropic request failed.');
      }
      if (!response.ok) {
        throw new AiError(`Anthropic request failed (HTTP ${response.status}).`);
      }
      const body = (await response.json()) as {
        content?: Array<{ type: string; text: string }>;
      };
      const text = body.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiError('Anthropic returned no message.');
      }
      return { text };
    },
  };
}

// ✅ CORRECTION : Extension du type pour accepter les configurations OpenAI et Anthropic.
// L'ajout de `| undefined` satisfait `exactOptionalPropertyTypes: true`.
export function resolveAiProvider(config: {
  provider: 'perplexity' | 'openai' | 'anthropic';
  perplexityApiKey?: string | undefined;
  perplexityModel?: string | undefined;
  openaiApiKey?: string | undefined;
  openaiModel?: string | undefined;
  anthropicApiKey?: string | undefined;
  anthropicModel?: string | undefined;
}): AiProvider | null {
  if (config.provider === 'perplexity') {
    if (!config.perplexityApiKey || !config.perplexityModel) return null;
    return perplexityProvider(config.perplexityApiKey, config.perplexityModel);
  }

  if (config.provider === 'openai') {
    if (!config.openaiApiKey || !config.openaiModel) return null;
    return openaiProvider(config.openaiApiKey, config.openaiModel);
  }

  if (config.provider === 'anthropic') {
    if (!config.anthropicApiKey || !config.anthropicModel) return null;
    return anthropicProvider(config.anthropicApiKey, config.anthropicModel);
  }

  return null;
}
