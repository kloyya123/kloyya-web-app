import { byDecisionScoreDesc } from '@/lib/decision-score';
import {
  allNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from '@/mock/notification-store';
import { API_STATUS } from '@/types/api';
import type { AppNotification } from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import type { NotificationService, PushSubscriptionInput } from './types';

/**
 * Mock notifications.
 *
 * Reads and writes the shared notification store, which the dashboard payload
 * also reads — so marking one read in the bell is immediately true on the
 * notifications page and in the dashboard. Ranking is KDSE's: decision score,
 * not recency.
 */
export class MockNotificationService implements NotificationService {
  async listNotifications(): Promise<AppNotification[]> {
    const ranked = allNotifications().sort(byDecisionScoreDesc);
    const { data } = await mockRespond(ranked);
    return data;
  }

  async markRead(id: string): Promise<AppNotification> {
    const updated = setNotificationRead(id, true);
    if (!updated) {
      mockError(
        API_STATUS.NotFound,
        'notification_not_found',
        'That notification no longer exists.',
        'It may have expired, or already been cleared.',
        'Refresh to see your current notifications.',
      );
    }

    const { data } = await mockRespond(updated);
    return data;
  }

  async markAllRead(): Promise<number> {
    const changed = markAllNotificationsRead();
    const { data } = await mockRespond(changed);
    return data;
  }

  // The mock backend has no push service to register with — these resolve
  // immediately rather than pretending a subscription was stored anywhere.
  async subscribePush(_subscription: PushSubscriptionInput): Promise<void> {
    await mockRespond(undefined);
  }

  async unsubscribePush(_endpoint: string): Promise<void> {
    await mockRespond(undefined);
  }
}
