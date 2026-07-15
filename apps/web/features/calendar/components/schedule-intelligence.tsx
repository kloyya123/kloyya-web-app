'use client';

import { BrainCircuit, CalendarCheck, TriangleAlert } from 'lucide-react';
import { ConfidenceBadge } from '@/components/ai';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  toast,
} from '@/components/ui';
import { toErrorPresentation } from '@/lib/error-presentation';
import { formatTime } from '@/lib/format';
import type { CalendarEvent, EventConflict, FocusSuggestion } from '@/types/calendar';
import { useHoldFocusTime } from '../hooks/use-schedule';

/**
 * The intelligence beside the grid — what Kloyya *noticed* about the schedule.
 *
 * This is the feature's argument: the grid any calendar has; the conflicts it
 * detected and the focus time it proposes (with reason and confidence, per the
 * Golden Rules) are what an AI Chief of Staff adds. "Hold this time" is a real
 * mutation: the block lands on the grid, and the suggestion list updates.
 */
export function ScheduleIntelligence({
  events,
  conflicts,
  suggestions,
}: {
  events: CalendarEvent[];
  conflicts: EventConflict[];
  suggestions: FocusSuggestion[];
}) {
  const eventById = new Map(events.map((event) => [event.id, event]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conflicts</CardTitle>
        </CardHeader>
        <CardContent>
          {conflicts.length === 0 ? (
            <p className="text-small text-muted-foreground">
              No double-bookings in view. Kloyya checks every time something new
              lands on your calendar.
            </p>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((conflict) => {
                const [first, second] = conflict.eventIds.map((id) => eventById.get(id));
                if (!first || !second) return null;
                return (
                  <li key={conflict.eventIds.join('+')} className="flex items-start gap-2.5">
                    <TriangleAlert aria-hidden="true" className="text-caution mt-0.5 size-4 shrink-0" />
                    <div className="text-small">
                      <p className="text-foreground font-medium">
                        {first.title} overlaps {second.title}
                      </p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {conflict.overlapMinutes} minutes of overlap from{' '}
                        {formatTime(second.startsAt)}. One of these needs to move.
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focus time</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <EmptyState
              icon={BrainCircuit}
              title="Nothing to protect today."
              description="When the day has meetings to work around, Kloyya suggests where deep work fits."
            />
          ) : (
            <ul className="space-y-4">
              {suggestions.map((suggestion) => (
                <FocusSuggestionRow
                  key={suggestion.slot.startsAt}
                  suggestion={suggestion}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FocusSuggestionRow({ suggestion }: { suggestion: FocusSuggestion }) {
  const hold = useHoldFocusTime();
  const { slot } = suggestion;

  function onHold() {
    hold.mutate(slot, {
      onSuccess: () =>
        toast.success(
          `Held ${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)} for focus.`,
        ),
      onError: (error) => toast.error(toErrorPresentation(error).title),
    });
  }

  return (
    <li className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small text-foreground font-medium tabular-nums">
          {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
        </p>
        <ConfidenceBadge confidence={suggestion.confidence} />
      </div>
      <p className="text-caption text-muted-foreground">{suggestion.reason}</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={onHold}
        isLoading={hold.isPending}
        loadingLabel="Holding this time"
        leadingIcon={<CalendarCheck aria-hidden="true" />}
      >
        Hold this time
      </Button>
    </li>
  );
}
