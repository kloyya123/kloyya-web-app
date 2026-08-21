import type { AppNotification } from '@/types/domain';
import { apiFetch } from '../http/transport';
import type { NotificationService, PushSubscriptionInput } from './types';

/** The real NotificationService — maps one-to-one onto /v1/notifications/*. */
export class HttpNotificationService implements NotificationService {
  async listNotifications(): Promise<AppNotification[]> {
    return apiFetch<AppNotification[]>('/v1/notifications');
  }

  async markRead(id: string): Promise<AppNotification> {
    return apiFetch<AppNotification>(`/v1/notifications/${encodeURIComponent(id)}`, { method: 'PATCH' });
  }

  async markAllRead(): Promise<number> {
    const { changed } = await apiFetch<{ changed: number }>('/v1/notifications/mark-all-read', {
      method: 'POST',
    });
    return changed;
  }

  async subscribePush(subscription: PushSubscriptionInput): Promise<void> {
    await apiFetch('/v1/notifications/push-subscriptions', { method: 'POST', body: subscription });
  }

  async unsubscribePush(endpoint: string): Promise<void> {
    await apiFetch('/v1/notifications/push-subscriptions', { method: 'DELETE', body: { endpoint } });
  }
}
