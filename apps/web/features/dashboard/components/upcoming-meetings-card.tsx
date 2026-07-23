'use client';

import { ArrowRight, CalendarClock, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { formatTime } from '@/lib/format';
import type { Meeting } from '@/types/domain';
import { SidebarCard } from './dashboard';

const VISIBLE = 3;

/**
 * What's coming up on the calendar today.
 *
 * A compact agenda: each event's name and its time range, newest cut at three
 * with an honest "+N more" — a preview of the day, not a second calendar.
 */
export function UpcomingMeetingsCard({ meetings }: { meetings: Meeting[] }) {
  const shown = meetings.slice(0, VISIBLE);
  const remaining = meetings.length - shown.length;

  return (
    <SidebarCard
      title="Upcoming"
      action={
        <Link
          href="/calendar"
          className="text-caption text-link inline-flex items-center gap-1 rounded-sm hover:underline"
        >
          View calendar
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      }
    >
      {meetings.length === 0 ? (
        // The Manifesto's own example of an empty state that educates.
        <EmptyState
          icon={CalendarClock}
          title="No meetings today."
          description="A rare opportunity for focused work. Kloyya will keep it that way."
        />
      ) : (
        <div className="space-y-4">
          <ul className="space-y-4">
            {shown.map((meeting) => (
              <li key={meeting.id} className="flex items-start gap-2.5">
                <CalendarDays aria-hidden="true" className="text-subtle mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-small text-foreground truncate font-medium">{meeting.title}</p>
                  <p className="text-caption text-subtle mt-0.5">
                    <time dateTime={meeting.startsAt}>{formatTime(meeting.startsAt)}</time>
                    {' – '}
                    <time dateTime={meeting.endsAt}>{formatTime(meeting.endsAt)}</time>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {remaining > 0 ? (
            <Link
              href="/calendar"
              className="text-caption text-subtle hover:text-foreground block text-center"
            >
              +{remaining} more {remaining === 1 ? 'event' : 'events'} today
            </Link>
          ) : null}
        </div>
      )}
    </SidebarCard>
  );
}
