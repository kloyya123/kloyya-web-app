/**
 * Formatting helpers.
 *
 * All of these take an ISO string and return a string. None take a `Date`:
 * timestamps cross the server/client boundary as strings, and parsing them in
 * two places is how a hydration mismatch starts.
 */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const DIVISIONS = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
] as const satisfies ReadonlyArray<{ amount: number; unit: Intl.RelativeTimeFormatUnit }>;

/**
 * "19 hours ago", "in 3 days".
 *
 * `now` is injectable so tests are deterministic and so a server render can be
 * pinned to the request time rather than to whenever the module was evaluated.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'unknown';

  let duration = (target - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return 'unknown';
}

/** "10 Jul", or "10 Jul 2027" when the year differs from now. */
export function formatDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';

  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(date);
}

/** "11:00". 24-hour, because an executive calendar is not a clock face. */
export function formatTime(iso: string, timeZone = 'UTC'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

/** Two initials, or one glyph. Shared by Avatar and by mentions. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.at(0) ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.at(0) ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
