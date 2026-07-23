'use client';

import { ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, Skeleton } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import { services } from '@/services';
import { SidebarCard } from './dashboard';

/**
 * A peek at the inbox, from the dashboard.
 *
 * Needs-attention threads first (same ranking the Priority Inbox uses), then
 * the rest, capped to three — it is a preview, not a second inbox.
 */
export function RecentMessagesCard() {
  const { data, isPending } = useQuery({
    queryKey: ['inbox', 'list'],
    queryFn: () => services.inbox.listInbox(),
    staleTime: 30_000,
  });

  const threads = data ? [...data.needsAttention, ...data.everythingElse].slice(0, 3) : [];

  return (
    <SidebarCard
      title="Recent messages"
      action={
        <Link
          href="/inbox"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          View all
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState icon={Mail} title="Inbox zero." description="Nothing waiting on you." />
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => (
            <li key={thread.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-small text-foreground truncate font-medium">
                  {thread.senderName}
                </p>
                <p className="text-caption text-subtle truncate">{thread.aiSummary}</p>
              </div>
              <span className="text-caption text-subtle shrink-0">
                {formatRelativeTime(thread.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}
