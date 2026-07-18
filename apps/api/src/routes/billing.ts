import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { can, SUBSCRIPTION_TIERS } from '@kloyya/core';
import { withTenantScope } from '@kloyya/db/scope';
import { memberships, organizations } from '@kloyya/db/schema';
import { z } from 'zod';
import { requireSession, requireVerifiedEmail } from '../auth/guard.js';
import { requireDb } from '../auth/permission.js';
import { config } from '../config.js';
import { ok } from '../http/envelope.js';
import { ApiError, API_STATUS, errors } from '../http/errors.js';
import { resolveStartContext } from '../integrations/connect.js';
import { PaymentError, resolvePaymentProvider } from '../payments/provider.js';

/**
 * Checkout — the onboarding plan step's endpoint.
 *
 * Free goes straight through (no payment); Pro carries a tokenised payment
 * method the paywall collected. Either way this records the chosen tier on the
 * (internal) organization, so entitlements downstream — Ask Kloyya's daily
 * limit, the document cap — read one authoritative value. Only someone who owns
 * the org may change its plan, the same rule that guards renaming it.
 *
 * No card data reaches here: the browser's provider SDK tokenises, and we accept
 * only the opaque token. Today the provider is the no-op scaffold, so nothing is
 * charged — but the shape is the real one, so wiring a processor later changes
 * this file not at all.
 */
const checkoutBody = z.object({
  tier: z.enum(SUBSCRIPTION_TIERS),
  paymentMethod: z
    .object({
      token: z.string().min(1),
      saveForFuture: z.boolean(),
    })
    .optional(),
});

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/billing/checkout',
    { preHandler: [requireSession, requireVerifiedEmail] },
    async (request) => {
      const ctx = request.auth;
      if (!ctx) throw errors.unauthorized();

      const { tier, paymentMethod } = checkoutBody.parse(request.body);

      const db = requireDb(request);
      const start = await resolveStartContext(db, ctx.user.id);
      if (!start) throw errors.notFound('User profile');

      // Billing is org-level, so only an owner (or admin — the matrix decides)
      // may set the plan. This mirrors the org-rename authorization.
      const mayBill = await withTenantScope(db, start.organizationId, async (tx) => {
        const [membership] = await tx
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, start.userId),
              eq(memberships.organizationId, start.organizationId),
            ),
          )
          .limit(1);
        return membership ? can(membership.role, 'org:update') : false;
      });

      if (!mayBill) {
        throw new ApiError({
          httpStatus: API_STATUS.Forbidden,
          errorCode: 'forbidden',
          message: 'You cannot change the plan for this workspace.',
          description: 'Changing the plan requires the org:update permission.',
          suggestedResolution: 'Ask an owner or administrator to change the plan.',
        });
      }

      const provider = resolvePaymentProvider({ provider: config.PAYMENT_PROVIDER });

      let result;
      try {
        result = await provider.checkout({ tier, paymentMethod });
      } catch (error) {
        if (error instanceof PaymentError) {
          throw new ApiError({
            httpStatus: API_STATUS.BadRequest,
            errorCode: 'payment_required',
            message: 'That plan needs a payment method.',
            description: error.message,
            suggestedResolution: 'Add a card, then try again.',
          });
        }
        throw error;
      }

      await withTenantScope(db, start.organizationId, async (tx) => {
        await tx
          .update(organizations)
          .set({ subscriptionTier: result.tier })
          .where(eq(organizations.id, start.organizationId));
      });

      return ok({ tier: result.tier, status: result.status }, request.correlationId);
    },
  );
}
