import { NextResponse } from 'next/server';
import { z } from 'zod';
import { entitlementsFor, remaining } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { resolveAiProvider } from '@server/ai/provider';
import { ask } from '@server/ask/service';
import { reserveAskCount, releaseAskCount } from '@server/ask/usage';
import { readTier } from '@server/plan/tier';
import { resolveStartContext } from '@server/tenant';

const askBody = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Ask a question.')
    .max(1000, 'That question is too long.'),
});

export const maxDuration = 60;

export const POST = kasRoute('verified', async (req, ctx) => {
  const { question } = askBody.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);

  if (!start) {
    throw errors.notFound('User profile');
  }

  const limit = entitlementsFor(await readTier(ctx.db, start)).askPerDay;

  const reservation = await reserveAskCount(ctx.db, start, limit);

  if (!reservation.allowed) {
    throw new ApiError({
      httpStatus: API_STATUS.RateLimited,
      errorCode: 'ask_limit_reached',
      message: 'You’ve reached today’s Ask Kloyya limit.',
      description:
        `Your plan allows ${limit} questions a day. ` +
        'It resets at midnight UTC.',
      suggestedResolution:
        'Try again tomorrow, or ask a broader question to cover more ground.',
    });
  }

  let releaseReservation = true;

  try {
    const provider = resolveAiProvider({
  provider: 'perplexity',
  ...(config.PERPLEXITY_API_KEY
    ? { perplexityApiKey: config.PERPLEXITY_API_KEY }
    : {}),
  perplexityModel: config.PERPLEXITY_MODEL,
});

    if (!provider) {
      console.error('[ask] AI provider not configured', {
        provider: 'perplexity',
        hasApiKey: Boolean(config.PERPLEXITY_API_KEY),
      });

      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'ai_unconfigured',
        message: 'Ask Kloyya is not configured on this server.',
        description: 'No Perplexity API key is configured.',
        suggestedResolution:
          'Set the Perplexity API key, then redeploy.',
      });
    }

    const outcome = await ask(ctx.db, start, question, provider);

    if (!outcome.ok) {
      if (outcome.reason === 'not_configured') {
        console.error('[ask] AI provider misconfigured', {
          provider: provider.name,
          model: provider.model,
        });

        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'ai_unconfigured',
          message: 'Ask Kloyya is not configured on this server.',
          description: 'The AI provider is not configured correctly.',
          suggestedResolution:
            'This has been logged. Please contact support if it persists.',
        });
      }

      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'ai_unavailable',
        message: 'Kloyya could not reach the AI model just now.',
        description:
          'The model host is temporarily unavailable or rate-limiting the request.',
        suggestedResolution: 'Try again in a moment.',
      });
    }

    releaseReservation = false;

    return NextResponse.json(
      ok(
        {
          ...outcome.result,
          usage: {
            used: reservation.used,
            limit,
            remaining: remaining(reservation.used, limit),
          },
        },
        ctx.correlationId,
      ),
    );
  } finally {
    if (releaseReservation) {
      try {
        await releaseAskCount(ctx.db, start, reservation.day);
      } catch {
        // Keep the quota consumed if the refund fails.
      }
    }
  }
});
