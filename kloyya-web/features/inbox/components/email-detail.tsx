'use client';

import {
  ArrowLeft,
  CalendarPlus,
  CheckSquare,
  Reply,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingRegion,
  Separator,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate, formatTime } from '@/lib/format';
import type { EmailInsights, EmailThread } from '@/types/domain';
import { useEmail, useEmailInsights } from '../hooks/use-inbox';
import { ImportanceBadge } from './importance-badge';

/**
 * One thread: the AI summary and why it matters up top, then what Kloyya read
 * out of it — suggested replies, extracted tasks, a detected meeting. Insights
 * are optional; a routine thread renders the summary alone.
 */
export function EmailDetail({ id }: { id: string }) {
  const { data: email, isPending, isError, error, refetch } = useEmail(id);

  if (isPending) {
    return (
      <LoadingRegion label="Loading the thread" className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </LoadingRegion>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/inbox"
        className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        All mail
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ImportanceBadge score={email.importanceScore} suffix=" priority" />
          {email.needsReply ? (
            <Badge tone="primary">
              <Reply aria-hidden="true" className="size-3" />
              Awaiting your reply
            </Badge>
          ) : null}
        </div>
        <h1 className="text-heading-m text-foreground font-semibold text-balance">
          {email.subject}
        </h1>
        <p className="text-small text-muted-foreground">
          {email.senderName}{' '}
          <span className="text-subtle">&lt;{email.senderEmail}&gt;</span> &middot;{' '}
          <span className="tabular-nums">
            {formatDate(email.receivedAt)} at {formatTime(email.receivedAt)}
          </span>
        </p>
      </header>

      <SummaryCard email={email} />
      <InsightsSection email={email} />
    </div>
  );
}

function SummaryCard({ email }: { email: EmailThread }) {
  return (
    <Card className="border-executive-purple/25">
      <CardHeader>
        <p className="text-caption text-ai flex items-center gap-1.5 font-medium">
          <Sparkles aria-hidden="true" className="size-3.5" />
          What this is
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-body text-foreground leading-relaxed">{email.aiSummary}</p>
        <p className="text-small text-muted-foreground">
          <span className="text-foreground font-medium">Why it ranks here:</span>{' '}
          {email.importanceReason}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AI insights
// ---------------------------------------------------------------------------

function InsightsSection({ email }: { email: EmailThread }) {
  const { data: insights, isPending } = useEmailInsights(email.id, true);

  if (isPending) {
    return (
      <LoadingRegion label="Reading the thread">
        <Skeleton className="h-56 rounded-lg" />
      </LoadingRegion>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-small text-muted-foreground">
            Nothing to action here — Kloyya prepares replies and tasks for mail
            that needs a decision.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SuggestedReplies insights={insights} />
      {insights.extractedTasks.length > 0 ? (
        <ExtractedTasks insights={insights} />
      ) : null}
      {insights.detectedMeeting ? (
        <DetectedMeetingCard meeting={insights.detectedMeeting} />
      ) : null}
    </div>
  );
}

function SuggestedReplies({ insights }: { insights: EmailInsights }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Reply aria-hidden="true" className="text-link size-4" />
          <CardTitle as="h2">Suggested replies</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {insights.suggestedReplies.map((reply) => (
            <li
              key={reply}
              className="border-border bg-muted/8 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-small text-foreground leading-relaxed">{reply}</p>
              <Button variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto">
                Use draft
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ExtractedTasks({ insights }: { insights: EmailInsights }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckSquare aria-hidden="true" className="text-positive size-4" />
          <CardTitle as="h2">Tasks Kloyya found</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.extractedTasks.map((task) => (
            <li
              key={task}
              className="text-small text-foreground flex items-center justify-between gap-3"
            >
              <span className="flex items-start gap-2.5">
                <span aria-hidden="true" className="text-subtle">
                  &middot;
                </span>
                {task}
              </span>
              <Button variant="ghost" size="sm" className="shrink-0">
                Add task
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DetectedMeetingCard({
  meeting,
}: {
  meeting: NonNullable<EmailInsights['detectedMeeting']>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarPlus aria-hidden="true" className="text-caution size-4" />
          <CardTitle as="h2">Meeting detected</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-small text-foreground font-medium">{meeting.title}</p>
        <p className="text-caption text-subtle tabular-nums">
          {meeting.proposedAt
            ? `${formatDate(meeting.proposedAt)} at ${formatTime(meeting.proposedAt)}`
            : 'No time proposed yet'}
        </p>
        <Separator />
        <p className="text-small text-muted-foreground">{meeting.note}</p>
      </CardContent>
    </Card>
  );
}
