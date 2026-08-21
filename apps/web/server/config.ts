import 'server-only';

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Environment schema                                                         */
/* -------------------------------------------------------------------------- */

const configSchema = z.object({
  /* ------------------------------------------------------------------------ */
  /* Runtime                                                                  */
  /* ------------------------------------------------------------------------ */

  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  /* ------------------------------------------------------------------------ */
  /* Database                                                                 */
  /* ------------------------------------------------------------------------ */

  DATABASE_URL: z
    .string()
    .url()
    .optional(),

  DIRECT_URL: z
    .string()
    .url()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Redis                                                                    */
  /* ------------------------------------------------------------------------ */

  REDIS_URL: z
    .string()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Supabase                                                                 */
  /* ------------------------------------------------------------------------ */

  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional(),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1)
    .optional(),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Documents                                                                */
  /* ------------------------------------------------------------------------ */

  DOCUMENTS_BUCKET: z
    .string()
    .min(1)
    .default('documents'),

  /* ------------------------------------------------------------------------ */
  /* Token encryption                                                         */
  /* ------------------------------------------------------------------------ */

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        Buffer.from(value, 'base64').length === 32,
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.',
    ),

  /* ------------------------------------------------------------------------ */
  /* Email                                                                     */
  /* ------------------------------------------------------------------------ */

  RESEND_API_KEY: z
    .string()
    .min(1)
    .optional(),

  EMAIL_FROM: z
    .string()
    .min(1)
    .default('Kloyya <onboarding@resend.dev>'),

  RESEND_AUDIENCE_ID: z
    .string()
    .min(1)
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Application                                                              */
  /* ------------------------------------------------------------------------ */

  APP_URL: z
    .string()
    .url()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Google OAuth                                                              */
  /* ------------------------------------------------------------------------ */

  GOOGLE_OAUTH_CLIENT_ID: z
    .string()
    .min(1)
    .optional(),

  GOOGLE_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1)
    .optional(),

  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Microsoft OAuth                                                          */
  /* ------------------------------------------------------------------------ */

  MICROSOFT_OAUTH_CLIENT_ID: z
    .string()
    .min(1)
    .optional(),

  MICROSOFT_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1)
    .optional(),

  MICROSOFT_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* Notion OAuth                                                             */
  /* ------------------------------------------------------------------------ */

  NOTION_OAUTH_CLIENT_ID: z
    .string()
    .min(1)
    .optional(),

  NOTION_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1)
    .optional(),

  NOTION_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .optional(),

  /* ------------------------------------------------------------------------ */
  /* AI                                                                        */
  /* ------------------------------------------------------------------------ */

  AI_PROVIDER: z
    .enum(['perplexity', 'openai', 'anthropic'])
    .default('perplexity'),

  /* Perplexity */

  PERPLEXITY_API_KEY: z
    .string()
    .min(1)
    .optional(),

  PERPLEXITY_MODEL: z
    .string()
    .min(1)
    .default('sonar'),

  /**
   * Legacy Vercel variable.
   *
   * Current production environment may still use:
   *
   * CLE_SONAR_API_KLOYYA2
   *
   * This is intentionally supported so the deployment does not break
   * before the secret is renamed to PERPLEXITY_API_KEY.
   */
  CLE_SONAR_API_KLOYYA2: z
    .string()
    .min(1)
    .optional(),

  /* OpenAI */

  OPENAI_API_KEY: z
    .string()
    .min(1)
    .optional(),

  OPENAI_MODEL: z
    .string()
    .min(1)
    .default('gpt-4o-mini'),

  /* Anthropic */

  ANTHROPIC_API_KEY: z
    .string()
    .min(1)
    .optional(),

  ANTHROPIC_MODEL: z
    .string()
    .min(1)
    .default('claude-3-5-sonnet-20241022'),

  /* ------------------------------------------------------------------------ */
  /* Payments                                                                 */
  /* ------------------------------------------------------------------------ */

  PAYMENT_PROVIDER: z
    .literal('none')
    .default('none'),

  /* ------------------------------------------------------------------------ */
  /* Rate limiting                                                            */
  /* ------------------------------------------------------------------------ */

  RATE_LIMIT_PER_MINUTE: z
    .coerce
    .number()
    .int()
    .min(1)
    .default(120),
});

/* -------------------------------------------------------------------------- */
/* Public config type                                                         */
/* -------------------------------------------------------------------------- */

export type Config = z.infer<typeof configSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  );
}

function validateProductionOAuth(
  provider: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
  redirectUri: string | undefined,
): void {
  const partiallyConfigured =
    Boolean(clientId) ||
    Boolean(clientSecret) ||
    Boolean(redirectUri);

  if (
    partiallyConfigured &&
    (!clientId || !clientSecret || !redirectUri)
  ) {
    throw new Error(
      `${provider} OAuth configuration is incomplete.`,
    );
  }

  if (!redirectUri) {
    return;
  }

  let url: URL;

  try {
    url = new URL(redirectUri);
  } catch {
    throw new Error(
      `${provider}_OAUTH_REDIRECT_URI is invalid.`,
    );
  }

  if (isLocalhost(url.hostname)) {
    throw new Error(
      `${provider}_OAUTH_REDIRECT_URI cannot point to localhost in production.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Environment loader                                                         */
/* -------------------------------------------------------------------------- */

function load(): Config {
  /**
   * Remove empty environment variables.
   *
   * This prevents:
   *
   *   SOME_KEY=""
   *
   * from being interpreted differently from an unset variable.
   */
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(
      ([, value]) => value !== '',
    ),
  );

  const parsed = configSchema.safeParse(cleaned);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) =>
          `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${issues}`,
    );
  }

  const parsedConfig = parsed.data;

  /* ------------------------------------------------------------------------ */
  /* Resolve Perplexity key                                                   */
  /* ------------------------------------------------------------------------ */

  /**
   * Canonical key:
   *
   *   PERPLEXITY_API_KEY
   *
   * Legacy Vercel key:
   *
   *   CLE_SONAR_API_KLOYYA2
   *
   * Canonical always wins if both exist.
   */
  const perplexityApiKey =
    parsedConfig.PERPLEXITY_API_KEY ??
    parsedConfig.CLE_SONAR_API_KLOYYA2;

  const config: Config = {
    ...parsedConfig,
    PERPLEXITY_API_KEY: perplexityApiKey,
  };

  /* ------------------------------------------------------------------------ */
  /* Production validation                                                    */
  /* ------------------------------------------------------------------------ */

  if (config.NODE_ENV === 'production') {
    const requiredProduction = {
      DATABASE_URL: config.DATABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL:
        config.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY:
        config.SUPABASE_SERVICE_ROLE_KEY,
      TOKEN_ENCRYPTION_KEY:
        config.TOKEN_ENCRYPTION_KEY,
      APP_URL: config.APP_URL,
    };

    const missing = Object.entries(requiredProduction)
      .filter(
        ([, value]) =>
          value === undefined ||
          value === '',
      )
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        [
          'Production environment is incomplete.',
          '',
          'Missing required variables:',
          ...missing.map(
            (name) => `  - ${name}`,
          ),
        ].join('\n'),
      );
    }

    /* ---------------------------------------------------------------------- */
    /* APP_URL                                                                */
    /* ---------------------------------------------------------------------- */

    let productionUrl: URL;

    try {
      productionUrl = new URL(config.APP_URL!);
    } catch {
      throw new Error(
        'APP_URL is invalid in production.',
      );
    }

    if (isLocalhost(productionUrl.hostname)) {
      throw new Error(
        'APP_URL cannot point to localhost in production.',
      );
    }

    /* ---------------------------------------------------------------------- */
    /* OAuth                                                                   */
    /* ---------------------------------------------------------------------- */

    validateProductionOAuth(
      'GOOGLE_OAUTH',
      config.GOOGLE_OAUTH_CLIENT_ID,
      config.GOOGLE_OAUTH_CLIENT_SECRET,
      config.GOOGLE_OAUTH_REDIRECT_URI,
    );

    validateProductionOAuth(
      'MICROSOFT_OAUTH',
      config.MICROSOFT_OAUTH_CLIENT_ID,
      config.MICROSOFT_OAUTH_CLIENT_SECRET,
      config.MICROSOFT_OAUTH_REDIRECT_URI,
    );

    validateProductionOAuth(
      'NOTION_OAUTH',
      config.NOTION_OAUTH_CLIENT_ID,
      config.NOTION_OAUTH_CLIENT_SECRET,
      config.NOTION_OAUTH_REDIRECT_URI,
    );

    /* ---------------------------------------------------------------------- */
    /* AI provider                                                             */
    /* ---------------------------------------------------------------------- */

    switch (config.AI_PROVIDER) {
      case 'perplexity': {
        if (!config.PERPLEXITY_API_KEY) {
          throw new Error(
            [
              'Perplexity is selected as AI_PROVIDER,',
              'but no Perplexity API key was found.',
              '',
              'Set one of:',
              '  - PERPLEXITY_API_KEY',
              '  - CLE_SONAR_API_KLOYYA2',
            ].join('\n'),
          );
        }

        if (!config.PERPLEXITY_MODEL) {
          throw new Error(
            'PERPLEXITY_MODEL is required when AI_PROVIDER is perplexity.',
          );
        }

        break;
      }

      case 'openai': {
        if (!config.OPENAI_API_KEY) {
          throw new Error(
            'OPENAI_API_KEY is required when AI_PROVIDER is openai.',
          );
        }

        if (!config.OPENAI_MODEL) {
          throw new Error(
            'OPENAI_MODEL is required when AI_PROVIDER is openai.',
          );
        }

        break;
      }

      case 'anthropic': {
        if (!config.ANTHROPIC_API_KEY) {
          throw new Error(
            'ANTHROPIC_API_KEY is required when AI_PROVIDER is anthropic.',
          );
        }

        if (!config.ANTHROPIC_MODEL) {
          throw new Error(
            'ANTHROPIC_MODEL is required when AI_PROVIDER is anthropic.',
          );
        }

        break;
      }

      default: {
        /**
         * This should be unreachable because Zod already validates
         * AI_PROVIDER, but keeping this guard makes the runtime
         * invariant explicit.
         */
        throw new Error(
          `Unsupported AI_PROVIDER: ${String(config.AI_PROVIDER)}`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Payments                                                               */
    /* ---------------------------------------------------------------------- */

    if (config.PAYMENT_PROVIDER !== 'none') {
      throw new Error(
        'Unsupported PAYMENT_PROVIDER.',
      );
    }
  }

  return config;
}

/* -------------------------------------------------------------------------- */
/* Exported configuration                                                     */
/* -------------------------------------------------------------------------- */

export const config = load();

export const isProduction =
  config.NODE_ENV === 'production';
