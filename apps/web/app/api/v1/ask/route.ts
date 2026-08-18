import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  entitlementsFor,
  remaining,
} from '@kloyya/core';

import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import {
  API_STATUS,
  ApiError,
  errors,
} from '@server/http/errors';

import { resolveAiProvider } from '@server/ai/provider';
import { ask } from '@server/ask/service';

import {
  reserveAskCount,
  releaseAskCount,
} from '@server/ask/usage';

import { readTier } from '@server/plan/tier';
import { resolveStartContext } from '@server/tenant';

/**
 * Ask Kloyya answers from the caller's own connected tools, and cites them.
 */
const askBody = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Ask a question.')
    .max(1000, 'That question is too long.'),
});

// Gmail/Drive-backed answers can be slow on Vercel.
export const maxDuration = 60;

export const POST = kasRoute('verified', async (req, ctx) => {
  const { question } = askBody.parse(await req.json());

  const start = await resolveStartContext(
    ctx.db,
    ctx.identity.id,
  );

  if (!start) {
    throw errors.notFound('User profile');
  }


  const limit = entitlementsFor(
    await readTier(ctx.db, start),
  ).askPerDay;


  const reservation = await reserveAskCount(
    ctx.db,
    start,
    limit,
  );

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


  let shouldReleaseReservation = true;

  try {
    const provider = resolveAiProvider({
      provider: config.AI_PROVIDER,

      openaiApiKey: config.OPENAI_API_KEY,
      openaiModel: config.OPENAI_MODEL,

      anthropicApiKey: config.ANTHROPIC_API_KEY,
      anthropicModel: config.ANTHROPIC_MODEL,
    });

    const outcome = await ask(
      ctx.db,
      start,
      question,
      provider,
    );

    if (!outcome.ok) {
      if (outcome.reason === 'not_configured') {
        throw new ApiError({
          httpStatus: API_STATUS.ServiceUnavailable,
          errorCode: 'ai_unconfigured',
          message:
            'Ask Kloyya is not set up on this server yet.',
          description:
            `No API key is configured for the ` +
            `"${config.AI_PROVIDER}" provider.`,
          suggestedResolution:
            'Set the provider’s API key, then redeploy.',
        });
      }

      throw new ApiError({
        httpStatus: API_STATUS.ServiceUnavailable,
        errorCode: 'ai_unavailable',
        message:
          'Kloyya could not reach the AI model just now.',
        description:
          'The model host is rate-limiting or temporarily unavailable.',
        suggestedResolution:
          'Try again in a moment — nothing needs fixing.',
      });
    }

 
    shouldReleaseReservation = false;

    return NextResponse.json(
      ok(
        {
          ...outcome.result,

          usage: {
            used: reservation.used,
            limit,
            remaining: remaining(
              reservation.used,
              limit,
            ),
          },
        },
        ctx.correlationId,
      ),
    );
  } finally {

    if (shouldReleaseReservation) {
      try {
        await releaseAskCount(
          ctx.db,
          start,
          reservation.day,
        );
      } catch {
        // Intentionally swallowed.
        //
        // The quota remains conservatively consumed if the refund
        // cannot be persisted.
      }
    }
  }
});
