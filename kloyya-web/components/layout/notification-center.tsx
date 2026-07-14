'use client';

import * as Popover from '@radix-ui/react-popover';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Badge, Button, EmptyState, Separator, Skeleton } from '@/components/ui';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/cn';
import { priorityFromDecisionScore } from '@/lib/decision-score';
import { formatRelativeTime } from '@/lib/format';
import type { AppNotification } from '@/types/domain';

/**
 * KDS: "Notifications should be actionable."
 * Design Manifesto: "Does this deserve interruption? If not, don't notify."
 *
 * Ordered by decision score, not recency — KDSE ranks competing items by score.
 * It reads its own query rather than the dashboard payload, so the bell is
 * correct on every route, not only where the dashboard happens to be loaded.
 * Opening a notification marks it read; nothing else does, because a badge that
 * clears itself teaches the user to ignore it.
 */
export function NotificationCenter() {
  const { data: notifications, isPending } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const list = notifications ?? [];
  const unreadCount = list.filter((item) => !item.isRead).length;
  const hasUnread = unreadCount > 0;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell aria-hidden="true" />
          {hasUnread ? (
            <span
              aria-hidden="true"
              className="bg-danger absolute top-1.5 right-1.5 size-2 rounded-full"
            />
          ) : null}
          <span className="sr-only">
            Notifications
            {hasUnread ? `, ${unreadCount} unread` : ', none unread'}
          </span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-card border-border shadow-level-3 data-[state=open]:animate-fade-in z-50 w-90 rounded-md border"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-small text-foreground font-semibold">Notifications</h2>
            <div className="flex items-center gap-2">
              {hasUnread ? <Badge tone="primary">{unreadCount} new</Badge> : null}
              {hasUnread ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllRead.mutate(undefined)}
                  leadingIcon={<CheckCheck aria-hidden="true" />}
                >
                  Mark all read
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />

          {isPending ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 rounded-sm" />
              <Skeleton className="h-14 rounded-sm" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nothing needs you right now."
              description="Kloyya only interrupts when something genuinely deserves your attention."
            />
          ) : (
            <>
              <ul className="max-h-96 overflow-y-auto p-2">
                {list.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onOpen={() => {
                        if (!notification.isRead) markRead.mutate(notification.id);
                      }}
                    />
                  </li>
                ))}
              </ul>

              <Separator />
              <div className="p-2">
                <Link
                  href="/notifications"
                  className="text-caption text-link hover:bg-hover block rounded-sm px-3 py-2 text-center font-medium"
                >
                  See all notifications
                </Link>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const priority = priorityFromDecisionScore(notification.decisionScore);
  const isUrgent = priority === 'Critical';

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-small',
            notification.isRead ? 'text-muted-foreground' : 'text-foreground font-medium',
          )}
        >
          {notification.title}
        </p>
        {isUrgent ? <Badge tone="danger">Critical</Badge> : null}
      </div>

      <p className="text-caption text-subtle mt-0.5">{notification.body}</p>

      <time dateTime={notification.createdAt} className="text-caption text-subtle mt-1 block">
        {formatRelativeTime(notification.createdAt)}
      </time>

      {!notification.isRead ? <span className="sr-only">Unread</span> : null}
    </>
  );

  const className = cn(
    'block w-full rounded-sm px-3 py-2.5 text-left transition-colors duration-150',
    'hover:bg-hover',
  );

  // With somewhere to go, it's a link that also marks itself read. Without,
  // it's a button whose only job is to mark itself read.
  return notification.href ? (
    <Link href={notification.href} className={className} onClick={onOpen}>
      {body}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onOpen} disabled={notification.isRead}>
      {body}
    </button>
  );
}
