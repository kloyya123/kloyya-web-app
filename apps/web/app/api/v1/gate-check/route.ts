import { NextResponse } from 'next/server';
import { betaAllowlist, isBetaAllowed } from '@/lib/beta-access';
import { ok } from '@server/http/envelope';
import { kasRoute } from '@server/http/handler';

/**
 * TEMPORARY diagnostic for the access gate.
 *
 * An allowlisted account was being held at /beta, which means middleware
 * computed `betaAllowed: false` for an address that is on the list. The three
 * candidate causes — the variable not reaching the Edge runtime, a formatting
 * problem in its value, or the session carrying no email — are indistinguishable
 * from the outside, and all three produce the same screen.
 *
 * This reports what the check actually sees for the calling session. It is
 * session-guarded, so only a signed-in caller can reach it, and it deliberately
 * returns the allowlist as a COUNT and a set of masked entries rather than the
 * addresses themselves: enough to tell "empty" from "populated" and to spot a
 * stray quote or space, without publishing the testers' personal addresses to
 * anyone who finds the URL.
 *
 * Delete once the gate is confirmed working.
 */
function mask(entry: string): string {
  // a…z@domain — keeps length and shape visible, hides the identity.
  const [local, domain] = entry.split('@');
  if (!local || !domain) return `«malformed: ${JSON.stringify(entry)}»`;
  const head = local.slice(0, 1);
  return `${head}${'·'.repeat(Math.max(local.length - 1, 0))}@${domain}`;
}

export const GET = kasRoute('session', async (_req, ctx) => {
  const list = betaAllowlist();
  const email = ctx.identity.email;

  return NextResponse.json(
    ok(
      {
        yourEmail: email,
        yourEmailLength: email.length,
        allowlistCount: list.length,
        // JSON.stringify on each entry surfaces a stray quote, space or newline
        // that a plain print would hide.
        allowlistShapes: list.map((entry) => JSON.stringify(mask(entry))),
        allowed: isBetaAllowed(email),
        // If this is false the variable never reached the runtime at all, and
        // the gate is failing OPEN rather than closed.
        variablePresent: list.length > 0,
      },
      ctx.correlationId,
    ),
  );
});
