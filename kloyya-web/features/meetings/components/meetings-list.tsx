'use client';

import { CalendarClock, Users } from 'lucide-react';
import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatDate, formatTime, initials } from '@/lib/format';
import type { Meeting } from '@/types/domain';
import { useMeetings } from '../hooks/use-meetings';

/**
 * The meetings list: what's coming (with intelligence being prepared for it)
 * and what happened (already distilled into summaries and decisions).
 */
export function MeetingsList() {
  const { data, isPending, isError, error, refetch } = useMeetings();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-heading-m text-foreground font-semibold">Meetings</h1>
        <p className="text-small text-muted-foreground">
          Briefed before you walk in. Summarized after you walk out.
        </p>
      </header>

      {isPending ? (
        <LoadingRegion label="Loading your meetings" className="space-y-4">
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
          <section aria-label="Coming up" className="space-y-3">
            <h2 className="text-title text-foreground font-semibold">Coming up</h2>
            {data.upcoming.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarClock}
                  title="Nothing scheduled."
                  description="When a meeting lands on your calendar, Kloyya starts preparing the briefing."
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {data.upcoming.map((meeting) => (
                  <li key={meeting.id}>
                    <MeetingRow meeting={meeting} isUpcoming />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Past meetings" className="space-y-3">
            <h2 className="text-title text-foreground font-semibold">Past</h2>
            {data.past.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Users}
                  title="No meeting history yet."
                  description="Summaries, decisions, and follow-ups will collect here."
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {data.past.map((meeting) => (
                  <li key={meeting.id}>
                    <MeetingRow meeting={meeting} isUpcoming={false} />
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

function MeetingRow({ meeting, isUpcoming }: { meeting: Meeting; isUpcoming: boolean }) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group block rounded-lg"
      aria-label={`${meeting.title}, ${formatDate(meeting.startsAt)} at ${formatTime(meeting.startsAt)}`}
    >
      <Card className="group-hover:border-muted flex flex-wrap items-center justify-between gap-4 p-5 transition-colors">
        <div className="min-w-0 space-y-1">
          <p className="text-body text-foreground font-medium">{meeting.title}</p>
          <p className="text-caption text-subtle tabular-nums">
            {formatDate(meeting.startsAt)} &middot; {formatTime(meeting.startsAt)}–
            {formatTime(meeting.endsAt)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ul className="flex -space-x-1.5" aria-label="Participants">
            {meeting.participants.map((participant) => (
              <li key={participant.userId}>
                <Avatar size="xs" className="ring-card ring-2">
                  <AvatarFallback>{initials(participant.fullName)}</AvatarFallback>
                </Avatar>
                <span className="sr-only">{participant.fullName}</span>
              </li>
            ))}
          </ul>

          {isUpcoming ? (
            <Badge tone="primary" withDot>
              Upcoming
            </Badge>
          ) : (
            <Badge tone="ai">Summarized</Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
