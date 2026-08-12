import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAiProvider } from '@server/ai/provider';
import { config } from '@server/config';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { checkRateLimit } from '@server/http/rate-limit';
import { getBriefing } from '@server/meetings/service';
import { resolveStartContext } from '@server/tenant';

const idParam = z.string().min(1, 'That is not a meeting id.');

export const GET = kasRoute('verified', async (_req, ctx) => {
  const id = idParam.parse(ctx.params['id']);
  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  // Generation is cached per meeting (see server/meetings/briefing.ts), so
  // the real cost surface is small, but the same guard as Ask costs nothing
  // to add and closes the same class of gap consistently.
  const burst = await checkRateLimit(ctx.db, `ai:${ctx.identity.id}`, config.AI_RATE_LIMIT_PER_MINUTE);
  if (!burst.allowed) {
    throw new ApiError({
      httpStatus: API_STATUS.RateLimited,
      errorCode: 'ask_rate_limited',
      message: 'Slow down — that’s a lot of requests in one minute.',
      description: `Kloyya allows ${burst.limit} AI requests per minute per person.`,
      suggestedResolution: `Wait about ${burst.retryAfterSeconds} seconds and try again.`,
    });
  }

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
  });

  const briefing = await getBriefing(ctx.db, start, provider, id);
  return NextResponse.json(ok(briefing, ctx.correlationId));
});
