import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db/client';
import { withTenantScope } from '@kloyya/db/scope';
import { pushSubscriptions } from '@kloyya/db/schema';
import type { StartContext } from '../tenant';

export interface SubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | undefined;
}

/**
 * Records (or refreshes) a browser's push subscription.
 *
 * `endpoint` is globally unique in the schema, so resubscribing the same
 * browser — after a key rotation, or just a second visit — updates its row
 * rather than accumulating duplicates. `onConflictDoUpdate` targets that
 * unique index directly.
 */
export async function upsertPushSubscription(
  db: AppDb,
  ctx: StartContext,
  input: SubscribeInput,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx
      .insert(pushSubscriptions)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent ?? null },
      });
  });
}

/** Removes a subscription by endpoint — called when the user turns notifications off. */
export async function deletePushSubscription(
  db: AppDb,
  ctx: StartContext,
  endpoint: string,
): Promise<void> {
  await withTenantScope(db, ctx.organizationId, async (tx) => {
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  });
}
