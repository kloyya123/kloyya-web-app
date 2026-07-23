import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { can, SUBSCRIPTION_TIERS } from '@kloyya/core';
import { withTenantScope } from '@kloyya/db/scope';
import { memberships, organizations } from '@kloyya/db/schema';
import { z } from 'zod';
import { kasRoute } from '@server/http/handler';
import { config } from '@server/config';
import { ok } from '@server/http/envelope';
import { API_STATUS, ApiError, errors } from '@server/http/errors';
import { resolveStartContext } from '@server/tenant';
import { PaymentError, resolvePaymentProvider } from '@server/payments/provider';

/**
 * Checkout — the onboarding plan step's endpoint. No card data reaches here: the
 * browser tokenises and we accept only the opaque token. Only an org owner (or
 * admin — the matrix decides) may set the plan.
 */
const checkoutBody = z.object({
  tier: z.enum(SUBSCRIPTION_TIERS),
  paymentMethod: z.object({ token: z.string().min(1), saveForFuture: z.boolean() }).optional(),
});

export const POST = kasRoute('verified', async (req, ctx) => {
  const { tier, paymentMethod } = checkoutBody.parse(await req.json());

  const start = await resolveStartContext(ctx.db, ctx.identity.id);
  if (!start) throw errors.notFound('User profile');

  const mayBill = await withTenantScope(ctx.db, start.organizationId, async (tx) => {
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

  await withTenantScope(ctx.db, start.organizationId, async (tx) => {
    await tx
      .update(organizations)
      .set({ subscriptionTier: result.tier })
      .where(eq(organizations.id, start.organizationId));
  });

  return NextResponse.json(ok({ tier: result.tier, status: result.status }, ctx.correlationId));
});
