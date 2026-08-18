import 'server-only';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL:
    z.string().url().optional(),

  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    z.string().min(1).optional(),

  SUPABASE_SERVICE_ROLE_KEY:
    z.string().min(1).optional(),

  DOCUMENTS_BUCKET:
    z.string().min(1).default('documents'),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        Buffer.from(value, 'base64').length === 32,
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.',
    ),

  RESEND_API_KEY:
    z.string().min(1).optional(),

  EMAIL_FROM:
    z.string()
      .min(1)
      .default('Kloyya <onboarding@resend.dev>'),

  RESEND_AUDIENCE_ID:
    z.string().min(1).optional(),

  APP_URL:
    z.string().url().default('http://localhost:3000'),

  GOOGLE_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  GOOGLE_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  GOOGLE_OAUTH_REDIRECT_URI:
    z.string()
      .url()
      .default(
        'http://localhost:3000/api/v1/integrations/oauth/google/callback',
      ),

  MICROSOFT_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  MICROSOFT_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  MICROSOFT_OAUTH_REDIRECT_URI:
    z.string()
      .url()
      .default(
        'http://localhost:3000/api/v1/integrations/oauth/microsoft/callback',
      ),

  NOTION_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  NOTION_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  NOTION_OAUTH_REDIRECT_URI:
    z.string()
      .url()
      .default(
        'http://localhost:3000/api/v1/integrations/oauth/notion/callback',
      ),


  AI_PROVIDER:
    z.literal('perplexity')
      .default('perplexity'),

  PERPLEXITY_API_KEY:
    z.string().min(1).optional(),

  PERPLEXITY_MODEL:
    z.string()
      .min(1)
      .default('sonar'),


  CLE_SONAR_API_KLOYYA2:
    z.string().min(1).optional(),

  PAYMENT_PROVIDER:
    z.literal('none').default('none'),

  RATE_LIMIT_PER_MINUTE:
    z.coerce
      .number()
      .int()
      .min(1)
      .default(120),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(
      ([, value]) => value !== '',
    ),
  );

  const parsed = schema.safeParse(cleaned);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) =>
          `  - ${
            issue.path.join('.') || '(root)'
          }: ${issue.message}`,
      )
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${issues}`,
    );
  }

  const config = parsed.data;

 
  if (config.NODE_ENV === 'production') {
    const required = {
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

    const missing = Object.entries(required)
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

    const appUrl = new URL(config.APP_URL);

    if (
      appUrl.hostname === 'localhost' ||
      appUrl.hostname === '127.0.0.1' ||
      appUrl.hostname === '0.0.0.0'
    ) {
      throw new Error(
        'APP_URL cannot point to localhost in production.',
      );
    }

 
    if (
      !config.CLE_SONAR_API_KLOYYA2 &&
      !config.PERPLEXITY_API_KEY
    ) {
      throw new Error(
        'CLE_SONAR_API_KLOYYA2 is required for Ask Kloyya in production.',
      );
    }
  }

  return {
    ...config,

  
    PERPLEXITY_API_KEY:
      config.CLE_SONAR_API_KLOYYA2 ??
      config.PERPLEXITY_API_KEY,
  };
}

export const config: Config = load();

export const isProduction =
  config.NODE_ENV === 'production';
