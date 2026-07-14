import type { AppNotification } from '@/types/domain';

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
}
