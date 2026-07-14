'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { assignLanes } from '@/lib/calendar-math';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import type { CalendarEvent, EventConflict, EventKind } from '@/types/calendar';

/**
 * The time grid: a gutter of hours and one positioned column per day.
 *
 * Blocks are absolutely positioned by minutes and lane-assigned when they
 * overlap (see calendar-math). They are deliberately non-interactive — the
 * Meetings feature is where a meeting opens, and a block that goes nowhere
 * should not look like it goes somewhere. Every block still carries its full
 * text, so a screen reader hears "Atlas milestone review, 11:00 to 12:00".
 */

/** The visible window: an hour either side of the 08:00–18:00 workday. */
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 19;
const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

const KIND_STYLES: Record<EventKind, string> = {
  meeting: 'bg-intelligence-blue/12 border-intelligence-blue',
  focus: 'bg-executive-purple/12 border-executive-purple',
  personal: 'bg-hover border-border',
};

export interface TimeGridProps {
  /** The days to render, "YYYY-MM-DD", in order. */
  days: string[];
  events: CalendarEvent[];
  conflicts: EventConflict[];
  /** Highlighted column (today / the anchor day). */
  anchorDay: string;
}

export function TimeGrid({ days, events, conflicts, anchorDay }: TimeGridProps) {
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.eventIds));
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, index) => GRID_START_HOUR + index,
  );

  return (
    // Wide content scrolls inside its own container; the page never scrolls sideways.
    <div className="overflow-x-auto">
      <div
        className="grid min-w-fit"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(8.5rem, 1fr))` }}
      >
        {/* Header row */}
        <div aria-hidden="true" />
        {days.map((day) => (
          <DayHeader key={day} day={day} isAnchor={day === anchorDay} />
        ))}

        {/* Hour gutter */}
        <div aria-hidden="true" className="relative" style={{ height: `${GRID_MINUTES}px` }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="text-caption text-subtle absolute right-2 -translate-y-1/2 tabular-nums"
              style={{ top: `${(((hour - GRID_START_HOUR) * 60) / GRID_MINUTES) * 100}%` }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            events={events.filter((event) => event.startsAt.slice(0, 10) === day)}
            conflictedIds={conflictedIds}
            hours={hours}
            isAnchor={day === anchorDay}
          />
        ))}
      </div>
    </div>
  );
}

function DayHeader({ day, isAnchor }: { day: string; isAnchor: boolean }) {
  const date = new Date(`${day}T00:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date);
  const dayOfMonth = date.getUTCDate();

  return (
    <div className="border-border flex items-baseline gap-1.5 border-b px-2 pb-2">
      <span className={cn('text-small font-medium', isAnchor ? 'text-link' : 'text-foreground')}>
        {weekday}
      </span>
      <span className="text-caption text-subtle tabular-nums">{dayOfMonth}</span>
    </div>
  );
}

function DayColumn({
  day,
  events,
  conflictedIds,
  hours,
  isAnchor,
}: {
  day: string;
  events: CalendarEvent[];
  conflictedIds: Set<string>;
  hours: number[];
  isAnchor: boolean;
}) {
  const lanes = assignLanes(events);
  const label = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));

  return (
    <section
      aria-label={label}
      className={cn(
        'border-border relative border-l',
        isAnchor && 'bg-intelligence-blue/4',
      )}
      style={{ height: `${GRID_MINUTES}px` }}
    >
      {/* Hour rules. Decorative. */}
      {hours.map((hour) => (
        <span
          key={hour}
          aria-hidden="true"
          className="border-border/60 absolute right-0 left-0 border-t"
          style={{ top: `${(((hour - GRID_START_HOUR) * 60) / GRID_MINUTES) * 100}%` }}
        />
      ))}

      {events.map((event) => (
        <EventBlock
          key={event.id}
          event={event}
          lane={lanes.get(event.id) ?? { lane: 0, laneCount: 1 }}
          isConflicted={conflictedIds.has(event.id)}
        />
      ))}
    </section>
  );
}

function EventBlock({
  event,
  lane,
  isConflicted,
}: {
  event: CalendarEvent;
  lane: { lane: number; laneCount: number };
  isConflicted: boolean;
}) {
  const gridStartMs = Date.parse(`${event.startsAt.slice(0, 10)}T00:00:00.000Z`) + GRID_START_HOUR * 3_600_000;
  const startMin = Math.max(0, (Date.parse(event.startsAt) - gridStartMs) / 60_000);
  const endMin = Math.min(GRID_MINUTES, (Date.parse(event.endsAt) - gridStartMs) / 60_000);
  const height = Math.max(endMin - startMin, 18); // Never thinner than its own text.

  const className = cn(
    'absolute overflow-hidden rounded-sm border-l-2 px-1.5 py-0.5',
    KIND_STYLES[event.kind],
    isConflicted && 'ring-warning/70 ring-1',
    event.meetingId && 'hover:brightness-110 transition-[filter]',
  );
  const style = {
    top: `${(startMin / GRID_MINUTES) * 100}%`,
    height: `${(height / GRID_MINUTES) * 100}%`,
    left: `calc(${(lane.lane / lane.laneCount) * 100}% + 2px)`,
    width: `calc(${(1 / lane.laneCount) * 100}% - 4px)`,
  };

  const content = (
    <>
      <p className="text-caption text-foreground truncate font-medium">
        {isConflicted ? (
          <TriangleAlert aria-hidden="true" className="text-caution mr-1 inline size-3" />
        ) : null}
        {event.title}
      </p>
      <p className="text-caption text-subtle truncate tabular-nums">
        {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
      </p>
      {isConflicted ? <span className="sr-only">Conflicts with another meeting.</span> : null}
    </>
  );

  // A block with meeting intelligence behind it links there. Anything else is
  // a plain block — nothing should look clickable that goes nowhere.
  return event.meetingId ? (
    <Link href={`/meetings/${event.meetingId}`} className={className} style={style}>
      {content}
      <span className="sr-only">Open meeting details.</span>
    </Link>
  ) : (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
