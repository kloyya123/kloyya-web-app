import { z } from 'zod';

/**
 * Validated environment.
 *
 * The process refuses to start if a required variable is missing or malformed —
 * a misconfigured server should fail loudly at boot, not silently at the first
 * request that needs the missing value. Everything the API reads from the
 * environment passes through here; nothing reads `process.env` directly.
 *
 * Fields blocked on external setup (the database, Supabase, Redis) are optional
 * for now so the foundation boots and its health check runs before those exist.
 * They become required in the phase that first depends on them.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Comma-separated allowlist of browser origins permitted to call the API.
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Wired in the phase that first needs them (Phase 3 DB, Phase 8 tokens).
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),

  /**
   * Encrypts customers' third-party OAuth tokens at rest (Phase 8).
   *
   * Validated here, at boot, rather than at the first connection: a key that
   * decodes to the wrong length is a deployment mistake, and the moment to find
   * out is on startup — not when someone is halfway through connecting Gmail.
   * (A base64 key can contain '/', which shells on Windows will happily rewrite
   * into a path; that failure is silent until it isn't.)
   */
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || Buffer.from(value, 'base64').length === 32,
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    ),

  // Better Auth. The secret signs sessions/tokens — required once auth is
  // actually mounted (see auth/auth.ts), optional here so the foundation and
  // its tests boot without it. BETTER_AUTH_URL is the API's own base URL, used
  // to build callback/verification links.
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:4000'),

  // Email (Resend). Optional so the foundation and its tests boot without it;
  // when absent, verification codes are logged instead of sent — see
  // resolveEmailSender, which refuses that fallback in production.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('Kloyya <onboarding@resend.dev>'),

  // Where the web app lives — invitation links point here, not at the API.
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Flatten to a readable list rather than Zod's nested object.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config: Config = load();

export const isProduction = config.NODE_ENV === 'production';
