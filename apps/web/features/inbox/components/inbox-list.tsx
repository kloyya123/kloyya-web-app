'use client';

import { Inbox as InboxIcon, Reply, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate } from '@/lib/format';
import type { EmailThread } from '@/types/domain';
import { useInbox } from '../hooks/use-inbox';
import { ImportanceBadge } from './importance-badge';

/**
 * The Priority Inbox: what needs you now, then everything else.
 *
 * Not a mail client — a triage surface. Every row leads with the AI summary and
 * says why it ranks where it does, so the reader decides from the list without
 * opening a thing.
 */
export function InboxList() {
  const { data, isPending, isError, error, refetch } = useInbox();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-m text-foreground font-semibold">Inbox</h1>
          {data && data.unreadCount > 0 ? (
            <Badge tone="primary" withDot>
              {data.unreadCount} unread
            </Badge>
          ) : null}
        </div>
        <p className="text-small text-muted-foreground">
          Triaged, not just listed. Kloyya surfaces the thread that changes your
          day — and says why.
        </p>
      </header>

      {isPending ? (
        <LoadingRegion label="Loading your inbox" className="space-y-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </LoadingRegion>
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <>
          <section aria-label="Needs attention" className="space-y-3">
            <h2 className="text-title text-foreground font-semibold">Needs attention</h2>
            {data.needsAttention.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Sparkles}
                  title="Nothing needs you right now."
                  description="When a thread carries a deadline, a decision, or an unanswered ask, it lands here."
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {data.needsAttention.map((email) => (
                  <li key={email.id}>
                    <EmailRow email={email} showReason />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Everything else" className="space-y-3">
            <h2 className="text-title text-foreground font-semibold">Everything else</h2>
            {data.everythingElse.length === 0 ? (
              <Card>
                <EmptyState
                  icon={InboxIcon}
                  title="Inbox zero on the rest."
                  description="Lower-priority mail collects here, most recent first."
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {data.everythingElse.map((email) => (
                  <li key={email.id}>
                    <EmailRow email={email} showReason={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function EmailRow({ email, showReason }: { email: EmailThread; showReason: boolean }) {
  return (
    <Link
      href={`/inbox/${email.id}`}
      className="group block rounded-lg"
      aria-label={`${email.subject}, from ${email.senderName}, ${formatDate(email.receivedAt)}`}
    >
      <Card className="group-hover:border-muted space-y-2 p-5 transition-colors">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {email.isUnread ? (
              <span
                aria-hidden="true"
                className="bg-intelligence-blue size-2 shrink-0 rounded-full"
              />
            ) : null}
            <p
              className={cn(
                'text-body text-foreground truncate',
                email.isUnread ? 'font-semibold' : 'font-medium',
              )}
            >
              {email.subject}
            </p>
            {email.isUnread ? <span className="sr-only">Unread.</span> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {email.needsReply ? (
              <Badge tone="primary">
                <Reply aria-hidden="true" className="size-3" />
                Reply
              </Badge>
            ) : null}
            <ImportanceBadge score={email.importanceScore} />
          </div>
        </div>

        <p className="text-caption text-subtle">
          {email.senderName} &middot;{' '}
          <span className="tabular-nums">{formatDate(email.receivedAt)}</span>
        </p>

        <p className="text-small text-muted-foreground line-clamp-2">{email.aiSummary}</p>

        {showReason ? (
          <p className="text-caption text-ai flex items-start gap-1.5">
            <Sparkles aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
            {email.importanceReason}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
