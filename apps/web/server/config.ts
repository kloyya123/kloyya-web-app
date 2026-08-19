import 'server-only';

import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  REDIS_URL: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  DOCUMENTS_BUCKET: z.string().min(1).default('documents'),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        Buffer.from(value, 'base64').length === 32,
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.',
    ),

  RESEND_API_KEY: z.string().min(1).optional(),

  EMAIL_FROM: z
    .string()
    .min(1)
    .default('Kloyya <onboarding@resend.dev>'),

  RESEND_AUDIENCE_ID: z.string().min(1).optional(),

  // Not defaulted: production validation below requires an
  // explicit value and independently rejects localhost.
  APP_URL: z.string().url().optional(),

  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  // Not defaulted: production validation below treats a present
  // redirect URI as "this provider is configured" and requires
  // the matching client id/secret. Defaulting this field would
  // make every deployment look "partially configured".
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),

  MICROSOFT_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_OAUTH_REDIRECT_URI: z.string().url().optional(),

  NOTION_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  NOTION_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  NOTION_OAUTH_REDIRECT_URI: z.string().url().optional(),

  AI_PROVIDER: z.literal('perplexity').default('perplexity'),

  PERPLEXITY_API_KEY: z.string().min(1).optional(),
  PERPLEXITY_MODEL: z.string().min(1).default('sonar'),

  // Legacy/alias env var name still used in some deployments.
  // Prefer PERPLEXITY_API_KEY for new configuration.
  CLE_SONAR_API_KLOYYA2: z.string().min(1).optional(),

  PAYMENT_PROVIDER: z.literal('none').default('none'),

  RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .default(120),
});

export type Config = z.infer<typeof configSchema>;

function load(): Config {
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

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const config = parsed.data;

  if (config.NODE_ENV === 'production') {
    const requiredProduction = {
      DATABASE_URL: config.DATABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: config.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
      TOKEN_ENCRYPTION_KEY: config.TOKEN_ENCRYPTION_KEY,
      APP_URL: config.APP_URL,
    };

    const missing = Object.entries(requiredProduction)
      .filter(([, value]) => value === undefined || value === '')
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        [
          'Production environment is incomplete.',
          '',
          'Missing required variables:',
          ...missing.map((name) => `  - ${name}`),
        ].join('\n'),
      );
    }

    const productionUrl = new URL(config.APP_URL!);

    if (
      productionUrl.hostname === 'localhost' ||
      productionUrl.hostname === '127.0.0.1' ||
      productionUrl.hostname === '0.0.0.0'
    ) {
      throw new Error(
        'APP_URL cannot point to localhost in production.',
      );
    }

    const oauthRedirects = [
      [
        'GOOGLE_OAUTH',
        config.GOOGLE_OAUTH_CLIENT_ID,
        config.GOOGLE_OAUTH_CLIENT_SECRET,
        config.GOOGLE_OAUTH_REDIRECT_URI,
      ],
      [
        'MICROSOFT_OAUTH',
        config.MICROSOFT_OAUTH_CLIENT_ID,
        config.MICROSOFT_OAUTH_CLIENT_SECRET,
        config.MICROSOFT_OAUTH_REDIRECT_URI,
      ],
      [
        'NOTION_OAUTH',
        config.NOTION_OAUTH_CLIENT_ID,
        config.NOTION_OAUTH_CLIENT_SECRET,
        config.NOTION_OAUTH_REDIRECT_URI,
      ],
    ] as const;

    for (const [
      provider,
      clientId,
      clientSecret,
      redirectUri,
    ] of oauthRedirects) {
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

      if (redirectUri) {
        const url = new URL(redirectUri);

        if (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1'
        ) {
          throw new Error(
            `${provider}_OAUTH_REDIRECT_URI cannot point to localhost in production.`,
          );
        }
      }
    }

    if (
      !config.PERPLEXITY_API_KEY &&
      !config.CLE_SONAR_API_KLOYYA2
    ) {
      throw new Error(
        'A Perplexity API key is required for Ask Kloyya in production ' +
          '(PERPLEXITY_API_KEY, or its legacy alias).',
      );
    }

    if (config.PAYMENT_PROVIDER !== 'none') {
      throw new Error('Unsupported PAYMENT_PROVIDER.');
    }
  }

  return {
    ...config,
    // Prefer the canonical name; fall back to the legacy alias
    // some deployments still use.
    PERPLEXITY_API_KEY:
      config.PERPLEXITY_API_KEY ?? config.CLE_SONAR_API_KLOYYA2,
  };
}

export const config = load();

export const isProduction = config.NODE_ENV === 'production';
