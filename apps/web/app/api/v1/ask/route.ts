import { NextResponse } from 'next/server';
import { z } from 'zod';
import { entitlementsFor, remaining, withinLimit } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { resolveAiProvider } from '@server/ai/provider';
import { ask } from '@server/ask/service';
import { getAskCountToday, incrementAskCount } from '@server/ask/usage';
import { readTier } from '@server/plan/tier';
import { resolveStartContext } from '@server/tenant';

/** Ask Kloyya answers from the caller's own connected tools, and cites them. */
const askBody = z.object({
  question: z.string().trim().min(1, 'Ask a question.').max(1000, 'That question is too long.'),
});

// A first Gmail/Drive-backed answer can be slow; give it room on Vercel.
export const maxDuration = 60;

export const POST = kasRoute('verified', async (req, ctx) => {
  const { question } = askBody.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  // Entitlement gate: the Free plan caps questions per day. Enforced here, not
  // only in the UI, because a client-side limit is a suggestion.
  const limit = entitlementsFor(await readTier(ctx.db, start)).askPerDay;
  const used = await getAskCountToday(ctx.db, start);
  if (!withinLimit(used, limit)) {
    throw new ApiError({
      httpStatus: API_STATUS.RateLimited,
      errorCode: 'ask_limit_reached',
      message: 'You’ve reached today’s Ask Kloyya limit.',
      description: `Your plan allows ${limit} questions a day. It resets at midnight UTC.`,
      // No "upgrade" prompt while billing is off — pointing at a plan nobody can
      // buy is a dead end. Restore it with the paywall.
      suggestedResolution: 'Try again tomorrow, or ask a broader question to cover more ground.',
    });
  }

  const provider = resolveAiProvider({
  provider: 'perplexity',
  perplexityApiKey: config.PERPLEXITY_API_KEY,
  perplexityModel: config.PERPLEXITY_MODEL,
});

  const outcome = await ask(ctx.db, start, question, provider);

  if (!outcome.ok) {
    if (outcome.reason === 'not_configured') {
      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'ai_unconfigured',
        message: 'Ask Kloyya is not set up on this server yet.',
        description: 'No Perplexity API key is configured.',
        suggestedResolution: 'Set the provider’s API key, then redeploy.',
      });
    }
    throw new ApiError({
      httpStatus: API_STATUS.ServiceUnavailable,
      errorCode: 'ai_unavailable',
      message: 'Kloyya could not reach the AI model just now.',
      description: 'The connection is fine; the model host is rate-limiting or briefly down.',
      suggestedResolution: 'Try again in a moment — nothing needs fixing.',
    });
  }

  // Only a real, answered question counts against the daily allowance.
  await incrementAskCount(ctx.db, start);

  return NextResponse.json(
    ok(
      { ...outcome.result, usage: { used: used + 1, limit, remaining: remaining(used + 1, limit) } },
      ctx.correlationId,
    ),
  );
});
