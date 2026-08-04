import 'server-only';
import { z } from 'zod';

/**
 * Validated server environment.
 *
 * The process refuses to start if a required variable is missing or malformed —
 * a misconfigured server should fail loudly, not silently at the first request
 * that needs the missing value. Everything server code reads from the
 * environment passes through here; nothing reads `process.env` directly.
 *
 * Ported from the retired Fastify API. Dropped: API_PORT, CORS_ALLOWED_ORIGINS,
 * LOG_LEVEL, BETTER_AUTH_SECRET, BETTER_AUTH_URL — meaningless once there is no
 * standalone server, no cross-origin browser, and no Better Auth. WEB_APP_URL
 * became APP_URL: there is only one app now, and it names itself, not "the web
 * app" as seen from a separate API.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),

  // Supabase. NEXT_PUBLIC_SUPABASE_URL is also read by browser code; validated
  // here too so a misconfigured deployment fails at boot, not at first request.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DOCUMENTS_BUCKET: z.string().min(1).default('documents'),

  /**
   * Encrypts customers' third-party OAuth tokens at rest.
   *
   * Validated here, at boot, rather than at the first connection: a key that
   * decodes to the wrong length is a deployment mistake, and the moment to find
   * out is on startup — not when someone is halfway through connecting Gmail.
   */
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || Buffer.from(value, 'base64').length === 32,
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    ),

  // Email (Resend). Optional so the app boots without it; when absent,
  // verification email is Supabase's own (dashboard-configured) and invitation
  // email is skipped with a clear log line rather than a crash.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('Kloyya <onboarding@resend.dev>'),
  /**
   * The Resend audience the beta waiting list mirrors into. Optional: without
   * it the list still records every signup in Postgres, it just cannot be
   * mailed from Resend until the audience is configured.
   */
  RESEND_AUDIENCE_ID: z.string().min(1).optional(),

  // Where this app is reachable — invitation links and OAuth redirects point
  // here. One app, one origin, so this is also the OAuth callback host.
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Google OAuth. Optional so the app boots without connectors; the connect
  // endpoint refuses clearly when they're absent rather than producing a
  // broken authorization URL.
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/integrations/oauth/google/callback'),

  // Microsoft OAuth (Outlook mail + calendar via Graph). One Azure app, common
  // authority. Optional for the same reason as Google's.
  MICROSOFT_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/integrations/oauth/microsoft/callback'),

  // Notion OAuth (pages + databases via search). Its tokens never expire, so
  // there is no refresh secret to rotate — just the client pair. The callback
  // lives under /oauth/ so it can't collide with the `notion` integration id.
  NOTION_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  NOTION_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  NOTION_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/integrations/oauth/notion/callback'),

  // Slack OAuth (Bot Token Scopes — the app is added to a workspace, not one
  // member's account). The bot token doesn't expire, so there is no refresh
  // secret here either, same reasoning as Notion above.
  SLACK_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  SLACK_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  SLACK_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/v1/integrations/oauth/slack/callback'),

  // AI (Ask Kloyya). Provider-neutral: AI_PROVIDER picks the default, and the
  // selected provider's key powers it. Both keys are server-only and optional —
  // absent, Ask Kloyya degrades to an honest "not configured" state.
  /**
   * Trusted web search (Level 3 of the source hierarchy). Both optional: with
   * neither set, Ask Kloyya answers from the workspace alone, exactly as it did
   * before the feature existed. Perplexity wins if both are present.
   */
  PERPLEXITY_API_KEY: z.string().min(1).optional(),
  PERPLEXITY_MODEL: z.string().min(1).default('sonar'),
  TAVILY_API_KEY: z.string().min(1).optional(),

  /**
   * The Sonar model that ANSWERS questions, as opposed to PERPLEXITY_MODEL
   * above, which finds sources. Both roles run on the one key, but they want
   * different settings — and eventually different models, since answering a hard
   * question well is a different job from listing links. Kept as two variables so
   * tuning one can never silently retune the other.
   */
  PERPLEXITY_CHAT_MODEL: z.string().min(1).default('sonar'),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'perplexity']).default('openai'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-4-8'),

  // Payments. Provider-neutral: 'none' is the beta scaffold (records the chosen
  // plan, takes no money). Raw card data never touches this server either way.
  PAYMENT_PROVIDER: z.enum(['none']).default('none'),

  // General API rate limit — requests per authenticated user per minute, a
  // blunt abuse guard on every guarded route (the Ask per-day cap is a separate
  // entitlement limit). `0` disables it. Coerced because env vars are strings.
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(120),

  /**
   * Shared secret for the scheduled-sync endpoint.
   *
   * That route acts on every workspace, so it cannot be guarded by a session
   * the way the rest of the API is — the caller is Vercel Cron, not a person.
   * Optional so local development and preview deploys boot without it, but the
   * route refuses to run when it is unset rather than defaulting to open: an
   * unauthenticated endpoint that syncs every tenant is worse than one that
   * does not run at all.
   */
  CRON_SECRET: z.string().min(1).optional(),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  // An empty-string env var (KEY="" in .env, or a blank Vercel variable) is the
  // same as unset — treat it that way so optional fields don't reject "" and
  // defaults still apply. Without this, one blank optional var breaks boot.
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  );
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const config: Config = load();

export const isProduction = config.NODE_ENV === 'production';
