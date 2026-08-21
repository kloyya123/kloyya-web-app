import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import type { AppDb } from '@kloyya/db/client';
import { pushSubscriptions } from '@kloyya/db/schema';
import { isAllowedOnChannel, priorityFromDecisionScore } from '@/lib/decision-score';
import { config } from '../config';

/**
 * Desktop push delivery.
 *
 * Per KDSE (`isAllowedOnChannel`, lib/decision-score.ts): only a Critical
 * (90-100) decision score may interrupt with a push. Everything else lands in
 * the in-app notification list only — `createNotification` (./service.ts)
 * always writes the row; this is the separate, stricter gate on top of it.
 *
 * VAPID keys are optional (see server/config.ts) so the app boots without
 * them; every function here no-ops with a clear log line rather than
 * throwing, since a missing push credential must never break the thing that
 * triggered it (a sync, a briefing).
 */

let configured = false;
function ensureConfigured(): boolean {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  href?: string | undefined;
}

/**
 * Sends a push to every subscribed device in a workspace, and prunes
 * subscriptions the push service reports as gone (410/404 — the user revoked
 * permission or uninstalled the browser) rather than retrying them forever.
 *
 * Silently declines — no-op, not a throw — when `decisionScore` doesn't clear
 * the Critical bar, or when VAPID isn't configured. Both are expected,
 * everyday states, not failures.
 */
export async function sendWorkspacePush(
  db: AppDb,
  workspaceId: string,
  decisionScore: number,
  payload: PushPayload,
): Promise<void> {
  if (!isAllowedOnChannel(priorityFromDecisionScore(decisionScore), 'push_notification')) return;
  if (!ensureConfigured()) return;

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.workspaceId, workspaceId));
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          dead.push(sub.id);
        } else {
          console.error('[push] delivery failed', { subscriptionId: sub.id, error });
        }
      }
    }),
  );

  if (dead.length > 0) {
    await Promise.all(dead.map((id) => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))));
  }
}
