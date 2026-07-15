'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-notifications';
import { useUrlState } from '@/hooks/use-url-state';
import { cn } from '@/lib/cn';
import { priorityFromDecisionScore } from '@/lib/decision-score';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatRelativeTime } from '@/lib/format';
import type { AppNotification } from '@/types/domain';

/**
 * Every notification, ranked by decision score — the same order the bell uses,
 * because they read the same service. Filter to what's still unread, mark one or
 * all read. Opening a notification marks it read; nothing else does.
 */
export function NotificationsView() {
  const [show, setShow] = useUrlState<'all' | 'unread'>('show', 'all');
  const unreadOnly = show === 'unread';
  const { data, isPending, isError, error, refetch } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const all = data ?? [];
  const unreadCount = all.filter((n) => !n.isRead).length;
  const visible = unreadOnly ? all.filter((n) => !n.isRead) : all;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-m text-foreground font-semibold">Notifications</h1>
            {unreadCount > 0 ? (
              <Badge tone="primary" withDot>
                {unreadCount} unread
              </Badge>
            ) : null}
          </div>
          <p className="text-small text-muted-foreground">
            Ranked by what matters, not by what arrived last.
          </p>
        </div>

        {unreadCount > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllRead.mutate(undefined)}
            leadingIcon={<CheckCheck aria-hidden="true" />}
          >
            Mark all read
          </Button>
        ) : null}
      </header>

      <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-2">
        <FilterChip active={!unreadOnly} onClick={() => setShow('all')}>
          All
        </FilterChip>
        <FilterChip active={unreadOnly} onClick={() => setShow('unread')}>
          Unread
        </FilterChip>
      </div>

      {isPending ? (
        <LoadingRegion label="Loading notifications" className="space-y-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title={unreadOnly ? 'Nothing unread.' : 'Nothing needs you right now.'}
            description="Kloyya only interrupts when something genuinely deserves your attention."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((notification) => (
            <li key={notification.id}>
              <NotificationCard
                notification={notification}
                onOpen={() => {
                  if (!notification.isRead) markRead.mutate(notification.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const isUrgent = priorityFromDecisionScore(notification.decisionScore) === 'Critical';

  const body = (
    <Card
      className={cn(
        'space-y-1.5 p-5 transition-colors',
        // Read state is carried by weight, colour, and the absent "New" badge —
        // never by opacity. Dimming the whole card multiplies down the already
        // subtle timestamp until it fails AA contrast (axe caught exactly this).
        notification.isRead ? 'border-border' : 'border-intelligence-blue/25',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p
          className={cn(
            'text-body',
            notification.isRead ? 'text-muted-foreground' : 'text-foreground font-semibold',
          )}
        >
          {notification.title}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {isUrgent ? <Badge tone="danger">Critical</Badge> : null}
          {!notification.isRead ? <Badge tone="primary">New</Badge> : null}
        </div>
      </div>

      <p className="text-small text-muted-foreground">{notification.body}</p>

      <time dateTime={notification.createdAt} className="text-caption text-subtle block">
        {formatRelativeTime(notification.createdAt)}
      </time>

      {!notification.isRead ? <span className="sr-only">Unread</span> : null}
    </Card>
  );

  return notification.href ? (
    <Link href={notification.href} className="group block rounded-lg" onClick={onOpen}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onOpen}
      disabled={notification.isRead}
      className="block w-full rounded-lg text-left"
    >
      {body}
    </button>
  );
}
