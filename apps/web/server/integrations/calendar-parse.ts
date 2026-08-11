/**
 * Turning a landed `calendar_event` sync record's raw provider JSON into
 * something the app can render — shared by the dashboard, the real calendar
 * feature, and the real meetings feature, all three of which read the exact
 * same `sync_records` rows and would otherwise each reimplement this parsing.
 *
 * Provider-agnostic on purpose: Google Calendar and Microsoft Graph name
 * fields differently (`summary` vs `subject`, `attendees[].email` vs
 * `attendees[].emailAddress.address`), and every reader here tries both
 * rather than branching on which connector landed the row.
 */

/** Read one string out of a provider payload, trying each key in turn. */
export function pick(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function toIso(raw: string): string | null {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Both providers wrap event times in an object: Google as
 * `{ dateTime, date }` (the second for all-day events), Graph as
 * `{ dateTime, timeZone }`. Returns an ISO string, or null when neither is
 * usable — a malformed event is skipped rather than rendered as "Invalid Date".
 */
export function readEventTime(value: unknown): string | null {
  if (typeof value === 'string') return toIso(value);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['dateTime', 'date']) {
      const inner = obj[key];
      if (typeof inner === 'string') return toIso(inner);
    }
  }
  return null;
}

/** The event's title. Google names it `summary`, Graph names it `subject`. */
export function readEventTitle(payload: Record<string, unknown>): string | null {
  return pick(payload, ['summary', 'subject', 'title']);
}

/** Attendee lists differ by provider; both carry a display name and an email. */
export function readParticipants(
  payload: Record<string, unknown>,
): { userId: string; fullName: string }[] {
  const raw = payload['attendees'];
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(0, 20) // A 300-person invite should not become 300 avatars.
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const person = entry as Record<string, unknown>;
      // Graph nests the address under emailAddress; Google puts it at the top.
      const nested = person['emailAddress'];
      const nestedObj = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : {};

      const name =
        pick(person, ['displayName']) ??
        pick(nestedObj, ['name']) ??
        pick(person, ['email']) ??
        pick(nestedObj, ['address']);
      if (!name) return null;

      const email = pick(person, ['email']) ?? pick(nestedObj, ['address']);
      return { userId: email ?? `attendee-${index}`, fullName: name };
    })
    .filter((p): p is { userId: string; fullName: string } => p !== null);
}
