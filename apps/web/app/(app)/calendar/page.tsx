import type { Metadata } from 'next';
import { parseDateParam } from '@/lib/calendar-math';
import { CalendarView } from '@/features/calendar/components/calendar-view';

export const metadata: Metadata = {
  title: 'Calendar',
  description: 'Your schedule, with the conflicts and focus time Kloyya found in it.',
  robots: { index: false, follow: false },
};

/**
 * URL owns the calendar position (?date=YYYY-MM-DD&view=day|week), validated
 * here on the server so the client component never sees a malformed value.
 * Garbage in either param falls back to today / week rather than crashing.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawDate = typeof params.date === 'string' ? params.date : undefined;
  const rawView = typeof params.view === 'string' ? params.view : undefined;

  return (
    <CalendarView
      date={parseDateParam(rawDate)}
      view={rawView === 'day' ? 'day' : 'week'}
    />
  );
}
