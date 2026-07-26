import { NextResponse } from 'next/server';
import { z } from 'zod';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError } from '@server/http/errors';
import { publicRoute } from '@server/http/handler';
import { checkRateLimit } from '@server/http/rate-limit';
import { resolveEmailSender } from '@server/email/resend';
import {
  addToResendAudience,
  joinWaitlist,
  sendWaitlistConfirmation,
} from '@server/waitlist/service';

/**
 * Join the private-beta waiting list.
 *
 * The only UNAUTHENTICATED write endpoint in the API, which changes what it has
 * to defend against — there is no session to rate-limit by and no account to
 * hold responsible, so the protections are different in kind from every other
 * route here:
 *
 *   Rate limited by client IP. Ten a minute is far above what a person filling
 *   in a form needs and far below what makes a script worth writing. The
 *   limiter fails open, so a database wobble cannot take the form down.
 *
 *   Replies identically whether the address was new or already present. Saying
 *   "you are already on the list" would turn this into an oracle for testing
 *   whether a given person signed up.
 *
 *   Length-capped before validation so a multi-megabyte body is rejected on
 *   sight rather than parsed.
 *
 * Deliberately NOT here: a CAPTCHA. It is the right answer if this is actually
 * abused, and the wrong first move — it costs every honest visitor something to
 * defend against an attack nobody has attempted yet.
 */
const body = z.object({
  email: z
    .string()
    .trim()
    .min(3, 'Enter your email address.')
    .max(254, 'That email address is too long.') // RFC 5321 maximum
    .email('That does not look like an email address.'),
  /** Where on the page they signed up, for attribution. Never shown back. */
  source: z.string().trim().max(60).optional(),
});

/** Per-IP ceiling per minute. Generous for a human, useless for a script. */
const SIGNUPS_PER_MINUTE = 10;

/**
 * The client's address, from the proxy header Vercel sets.
 *
 * `x-forwarded-for` is client-controlled in general, but on Vercel the platform
 * overwrites it with the real peer address, so the leftmost entry is
 * trustworthy here. Falls back to a shared bucket when absent — which throttles
 * unattributable traffic together rather than letting it through unlimited.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}

export const POST = publicRoute(async (req, ctx) => {
  const rate = await checkRateLimit(ctx.db, `waitlist:${clientIp(req)}`, SIGNUPS_PER_MINUTE);
  if (!rate.allowed) {
    throw new ApiError({
      httpStatus: API_STATUS.RateLimited,
      errorCode: 'rate_limited',
      message: 'Too many attempts.',
      description: 'Several sign-ups have come from this connection in the last minute.',
      suggestedResolution: 'Wait a moment and try again.',
    });
  }

  const { email, source } = body.parse(await req.json());

  const { isNew } = await joinWaitlist(ctx.db, email, source ?? 'landing');

  // Both side effects are awaited so a serverless function is not frozen
  // mid-flight, and both swallow their own failures — the database already
  // holds the record, and losing a signup to protect a receipt would be the
  // wrong trade.
  await addToResendAudience(email, {
    apiKey: config.RESEND_API_KEY,
    audienceId: config.RESEND_AUDIENCE_ID,
  });

  // Only on a genuinely new row, so submitting twice does not send twice. The
  // HTTP response below is identical either way, so this leaks nothing about
  // whether the address was already known.
  if (isNew) await sendWaitlistConfirmation(email, resolveEmailSender());

  // Identical response for a new and an existing address. See the note above.
  return NextResponse.json(
    ok({ status: 'joined' as const }, ctx.correlationId),
  );
});
