'use client';

import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from '@/components/ui';
import {
  addDaysUtc,
  startOfWeekUtc,
  todayUtc,
} from '@/lib/calendar-math';
import { cn } from '@/lib/cn';
import { toErrorPresentation } from '@/lib/error-presentation';
import type { CalendarViewKind } from '@/types/calendar';
import { useSchedule } from '../hooks/use-schedule';
import { ScheduleIntelligence } from './schedule-intelligence';
import { TimeGrid } from './time-grid';

export interface CalendarViewProps {
  /** Validated by the page. "YYYY-MM-DD". */
  date: string;
  view: CalendarViewKind;
}

/**
 * The calendar. URL owns the navigation state (KFA: "URL should always reflect
 * navigation state") — prev/next/today and the view toggle all navigate, so any
 * calendar position is shareable and survives a refresh.
 */
export function CalendarView({ date, view }: CalendarViewProps) {
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useSchedule(date, view);

  function go(nextDate: string, nextView: CalendarViewKind = view) {
    router.replace(`/calendar?date=${nextDate}&view=${nextView}`);
  }

  const step = view === 'week' ? 7 : 1;
  const days =
    view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDaysUtc(startOfWeekUtc(date), index))
      : [date];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-heading-m text-foreground font-semibold">Calendar</h1>
          <p className="text-small text-muted-foreground">{rangeLabel(days)}</p>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={(next) => go(date, next)} />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => go(addDaysUtc(date, -step))}>
              <ChevronLeft aria-hidden="true" />
              <span className="sr-only">Previous {view}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => go(todayUtc())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => go(addDaysUtc(date, step))}>
              <ChevronRight aria-hidden="true" />
              <span className="sr-only">Next {view}</span>
            </Button>
          </div>
        </div>
      </header>

      {isPending ? (
        <CalendarSkeleton />
      ) : isError ? (
        <Card>
          <ErrorState error={toErrorPresentation(error)} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* min-w-0: without it this grid child sizes to the time grid's
              intrinsic width (~1040px) and the page scrolls sideways on a phone,
              instead of the grid scrolling inside its own container. */}
          <Card className="min-w-0 p-4">
            {data.events.length === 0 && view === 'day' ? (
              <EmptyDay />
            ) : (
              <TimeGrid
                days={days}
                events={data.events}
                conflicts={data.conflicts}
                anchorDay={date}
              />
            )}
          </Card>

          <aside aria-label="Schedule intelligence">
            <ScheduleIntelligence
              events={data.events}
              conflicts={data.conflicts}
              suggestions={data.focusSuggestions}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: CalendarViewKind;
  onChange: (view: CalendarViewKind) => void;
}) {
  return (
    <div role="group" aria-label="Calendar view" className="border-border flex rounded-sm border p-0.5">
      {(['day', 'week'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={cn(
            'text-small rounded-[6px] px-3 py-1 font-medium capitalize transition-colors',
            view === option
              ? 'bg-intelligence-blue/12 text-link'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="bg-hover text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <CalendarOff aria-hidden="true" className="size-6" />
      </span>
      <p className="text-body text-foreground font-medium">Nothing scheduled.</p>
      <p className="text-small text-muted-foreground max-w-sm text-balance">
        No meetings today. A rare opportunity for focused work — Kloyya will keep
        it that way.
      </p>
    </div>
  );
}

function rangeLabel(days: string[]): string {
  const format = (day: string, withMonth: boolean) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      ...(withMonth ? { month: 'short', year: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00.000Z`));

  const first = days[0]!;
  const last = days.at(-1)!;
  if (days.length === 1) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${first}T00:00:00.000Z`));
  }
  return `${format(first, false)}–${format(last, true)}`;
}

function CalendarSkeleton() {
  return (
    <LoadingRegion label="Loading your schedule" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Skeleton className="h-[720px] rounded-lg" />
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </LoadingRegion>
  );
}
