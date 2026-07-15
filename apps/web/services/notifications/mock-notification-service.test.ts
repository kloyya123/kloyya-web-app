import { beforeEach, describe, expect, it } from 'vitest';
import { isApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { MockIntelligenceService } from '../intelligence/mock-intelligence-service';
import { MockNotificationService } from './mock-notification-service';

describe('MockNotificationService', () => {
  const service = new MockNotificationService();

  beforeEach(() => {
    configureMockTransport({ instant: true, failureRate: 0 });
  });

  it('ranks by decision score, highest first', async () => {
    const notifications = await service.listNotifications();
    const scores = notifications.map((n) => n.decisionScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('marks one read, and the change persists', async () => {
    const before = await service.listNotifications();
    const unread = before.find((n) => !n.isRead);
    expect(unread).toBeDefined();

    const updated = await service.markRead(unread!.id);
    expect(updated.isRead).toBe(true);

    const after = await service.listNotifications();
    expect(after.find((n) => n.id === unread!.id)?.isRead).toBe(true);
  });

  it('throws a non-retryable 404 for an unknown id', async () => {
    await expect(service.markRead('notif_nope')).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.httpStatus === 404 && !error.isRetryable,
    );
  });

  it('marks everything read, and reports how many changed', async () => {
    const changed = await service.markAllRead();
    expect(changed).toBeGreaterThanOrEqual(0);

    const after = await service.listNotifications();
    expect(after.every((n) => n.isRead)).toBe(true);

    // Nothing left to change the second time.
    expect(await service.markAllRead()).toBe(0);
  });

  it('shares one store with the dashboard, so the bell and the page agree', async () => {
    // This is the whole reason the store exists: marking read here must be
    // visible in the dashboard payload the app shell renders the bell from.
    const intelligence = new MockIntelligenceService();
    await service.markAllRead();

    const { notifications } = await intelligence.getDashboard();
    expect(notifications.every((n) => n.isRead)).toBe(true);
  });
});
