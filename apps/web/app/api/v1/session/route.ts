import { NextResponse } from 'next/server';
import { kasRoute } from '@server/http/handler';
import { ok } from '@server/http/envelope';
import { errors } from '@server/http/errors';
import { composeSession } from '@server/users/service';
import { ensureProvisioned } from '@server/users/ensure';

/**
 * The full session the frontend renders the app shell from: identity,
 * organization, active workspace and preferences.
 *
 * Only 'session' guard, NOT 'verified': an unverified user must be able to load
 * their session so the client can route them to the verify screen.
 *
 * This is also the single place lazy provisioning happens — a brand-new
 * Supabase identity gets its tenant (org + workspace + profile) created here on
 * first load, before any other endpoint needs the profile.
 */
export const GET = kasRoute('session', async (_req, ctx) => {
  await ensureProvisioned(ctx.db, ctx.identity);

  const session = await composeSession(ctx.db, ctx.identity);
  if (!session) throw errors.notFound('User profile');

  return NextResponse.json(ok(session, ctx.correlationId));
});
