import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { organizations } from '@kloyya/db/schema';
import type { SubscriptionTier } from '@kloyya/core';
import type { StartContext } from '../integrations/connect.js';

/**
 * The workspace's plan tier — the value entitlements read.
 *
 * Shared by every feature that gates on the plan (Ask's daily limit, the document
 * cap), so there is one answer to "what plan is this?". Defaults to free if the
 * row is somehow missing — the safe direction is fewer entitlements, not more.
 */
export async function readTier(db: AppDb, ctx: StartContext): Promise<SubscriptionTier> {
  const [row] = await withTenantScope(db, ctx.organizationId, async (tx) =>
    tx
      .select({ tier: organizations.subscriptionTier })
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1),
  );
  return row?.tier ?? 'free';
}
