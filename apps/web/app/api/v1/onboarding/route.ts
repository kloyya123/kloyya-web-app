import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GOALS, PROACTIVENESS, SUBSCRIPTION_TIERS } from '@kloyya/core';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { completeOnboarding } from '@server/users/onboarding';
import { composeSession } from '@server/users/service';
import { markOnboarded } from '@server/users/metadata';

/**
 * Onboarding.
 *
 * The schema is built from the same @kloyya/core constants the frontend's forms
 * use, so "what the UI offers" and "what the API accepts" cannot drift apart.
 * On success it also stamps `onboarded` into the Supabase user metadata, so the
 * middleware can gate the dashboard without a database round-trip.
 */
const onboardingSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  goals: z.array(z.enum(GOALS)),
  priorities: z.array(z.string().trim().min(1).max(120)).max(20),
  proactiveness: z.enum(PROACTIVENESS),
  plan: z.enum(SUBSCRIPTION_TIERS),
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const profile = onboardingSchema.parse(await req.json());

  const onboarded = await completeOnboarding(ctx.db, ctx.identity.id, profile);
  if (!onboarded) throw errors.notFound('User profile');

  await markOnboarded(ctx.identity.id);

  const session = await composeSession(ctx.db, ctx.identity);
  if (!session) throw errors.notFound('User profile');

  return NextResponse.json(ok(session, ctx.correlationId));
});
