import type { AppNotification } from '@/types/domain';
import { mockNotifications } from './organization';

/**
 * The single mutable store for notification read-state.
 *
 * Two surfaces read these records — the bell in the app shell and the
 * notifications page — and the dashboard payload carries them too. If each read
 * its own copy of the mock array, marking one read in the bell would leave the
 * page (and the dashboard) still showing it unread. One store, so they cannot
 * disagree. A real backend gives this for free; the mock has to be deliberate.
 *
 * Session-scoped, exactly like the recommendations map: outcomes persist while
 * the app is open, and reset on reload.
 */
const store = new Map<string, AppNotification>(
  mockNotifications.map((notification) => [notification.id, { ...notification }]),
);

export function allNotifications(): AppNotification[] {
  return [...store.values()];
}

export function findNotification(id: string): AppNotification | undefined {
  return store.get(id);
}

/** Returns the updated record, or undefined when the id is unknown. */
export function setNotificationRead(id: string, isRead: boolean): AppNotification | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;

  const updated: AppNotification = { ...existing, isRead };
  store.set(id, updated);
  return updated;
}

/** Marks every notification read. Returns how many actually changed. */
export function markAllNotificationsRead(): number {
  let changed = 0;
  for (const [id, notification] of store) {
    if (notification.isRead) continue;
    store.set(id, { ...notification, isRead: true });
    changed += 1;
  }
  return changed;
}
