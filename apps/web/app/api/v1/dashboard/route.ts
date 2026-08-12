import { NextResponse } from 'next/server';
import { resolveAiProvider } from '@server/ai/provider';
import { config } from '@server/config';
import { getDashboard } from '@server/dashboard/service';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { kasRoute } from '@server/http/handler';
import { resolveStartContext } from '@server/tenant';

/**
 * The dashboard, read from the caller's own workspace.
 *
 * Everything is scoped by the start context resolved from the session — never
 * from a query parameter — and the query runs inside `withTenantScope`, so RLS
 * is the backstop even if the WHERE clause were wrong.
 *
 * The AI provider is passed in for the morning briefing. Null when no key is
 * configured, which the dashboard renders as no briefing rather than an error —
 * the same honest-empty contract as every other panel here.
 */
export const GET = kasRoute('verified', async (_req, ctx) => {
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const provider = resolveAiProvider({
    provider: config.AI_PROVIDER,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiModel: config.OPENAI_MODEL,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    anthropicModel: config.ANTHROPIC_MODEL,
    perplexityApiKey: config.PERPLEXITY_API_KEY,
    perplexityChatModel: config.PERPLEXITY_CHAT_MODEL,
    nvidiaApiKey: config.NVIDIA_API_KEY,
    nvidiaModel: config.NVIDIA_MODEL,
    huggingfaceApiKey: config.HUGGINGFACE_API_KEY,
    huggingfaceModel: config.HUGGINGFACE_MODEL,
  });

  const dashboard = await getDashboard(ctx.db, start, new Date(), provider);
  return NextResponse.json(ok(dashboard, ctx.correlationId));
});
