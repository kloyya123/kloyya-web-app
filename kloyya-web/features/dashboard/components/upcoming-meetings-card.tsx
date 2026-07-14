'use client';

import { CalendarClock } from 'lucide-react';
import { Avatar, AvatarFallback, EmptyState } from '@/components/ui';
import { formatRelativeTime, formatTime, initials } from '@/lib/format';
import type { Meeting } from '@/types/domain';
import { SidebarCard } from './dashboard';

export function UpcomingMeetingsCard({ meetings }: { meetings: Meeting[] }) {
  return (
    <SidebarCard title="Coming up">
      {meetings.length === 0 ? (
        // The Manifesto's own example of an empty state that educates.
        <EmptyState
          icon={CalendarClock}
          title="No meetings today."
          description="A rare opportunity for focused work. Kloyya will keep it that way."
        />
      ) : (
        <ul className="space-y-4">
          {meetings.slice(0, 3).map((meeting) => (
            <li key={meeting.id} className="space-y-2">
              <div>
                <p className="text-small text-foreground font-medium">{meeting.title}</p>
                <p className="text-caption text-subtle mt-0.5">
                  <time dateTime={meeting.startsAt}>{formatTime(meeting.startsAt)}</time>
                  {' · '}
                  {formatRelativeTime(meeting.startsAt)}
                </p>
              </div>

              <ul className="flex -space-x-1.5" aria-label="Participants">
                {meeting.participants.map((participant) => (
                  <li key={participant.userId}>
                    <Avatar size="xs" className="ring-card ring-2">
                      <AvatarFallback>{initials(participant.fullName)}</AvatarFallback>
                    </Avatar>
                    {/* The stacked avatars are decorative; the names are not. */}
                    <span className="sr-only">{participant.fullName}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}
