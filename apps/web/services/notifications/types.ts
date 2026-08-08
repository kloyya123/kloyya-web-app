import type { AppNotification } from '@/types/domain';

/** What the browser's `PushManager.subscribe()` returns, trimmed to what the server stores. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | undefined;
}

/**
 * The notifications contract.
 *
 * KDSE orders competing items by decision score, not recency — a Critical alert
 * from an hour ago outranks a routine one from a minute ago. That ranking is the
 * service's job, not a widget's, so every surface that lists notifications gets
 * the same order.
 */
export interface NotificationService {
  /** Ranked by decision score, highest first. */
  listNotifications(): Promise<AppNotification[]>;

  /** Throws 404 for an unknown id. */
  markRead(id: string): Promise<AppNotification>;

  /** Marks everything read. Resolves with how many changed. */
  markAllRead(): Promise<number>;

  /** Registers a browser's Web Push subscription for desktop notifications. */
  subscribePush(subscription: PushSubscriptionInput): Promise<void>;

  /** Removes a browser's subscription — called when the user turns notifications off. */
  unsubscribePush(endpoint: string): Promise<void>;
}
