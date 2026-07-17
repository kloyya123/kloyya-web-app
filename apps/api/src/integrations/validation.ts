import type { RawGmailMessage } from './gmail.js';
import type { RawGoogleEvent } from './google-calendar.js';

/**
 * Phase 8.5 — validation before storage.
 *
 * "Every imported object must pass validation before storage." Landing raw does
 * not mean landing anything: raw means we don't reinterpret what a provider
 * says, not that we accept what it couldn't have meant. An event with no id
 * can't be keyed, an unparseable timestamp poisons every downstream comparison,
 * and a duplicate identifier silently loses one of two real meetings.
 *
 * Garbage in produces garbage out — and the point of this phase is that the
 * Intelligence Pipeline never has to wonder whether its inputs are sound.
 *
 * Rejections are counted and returned, never swallowed: a connector that
 * quietly drops records is indistinguishable from one that works.
 */
export interface ValidationFailure {
  externalId: string | null;
  reason: string;
}

export interface ValidatedBatch<T> {
  valid: T[];
  rejected: ValidationFailure[];
}

/** The statuses Google actually issues. Anything else is an object we don't know. */
const KNOWN_STATUSES = new Set(['confirmed', 'tentative', 'cancelled']);

function isParsableTime(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Whether an event's start/end are usable.
 *
 * Google expresses a timed event as `dateTime` and an all-day one as `date`;
 * both are legitimate, and treating an all-day event as malformed would quietly
 * drop every holiday and out-of-office from the calendar.
 */
function validateWhen(slot: unknown, label: string): string | null {
  if (slot === undefined || slot === null) return `${label} is missing`;
  if (typeof slot !== 'object') return `${label} is not an object`;

  const when = slot as { dateTime?: unknown; date?: unknown };
  if (when.dateTime !== undefined) {
    return isParsableTime(when.dateTime) ? null : `${label}.dateTime is not a valid timestamp`;
  }
  if (when.date !== undefined) {
    return isParsableTime(when.date) ? null : `${label}.date is not a valid date`;
  }
  return `${label} has neither dateTime nor date`;
}

/**
 * Validate a batch of raw Calendar events.
 *
 * Cancelled events are held to a lower bar deliberately: Google sends them as
 * little more than an id and a status, and that is exactly what a tombstone
 * needs to be. Demanding a start time from a deleted event would reject the
 * very records that tell us a meeting is gone.
 */
export function validateCalendarEvents(events: RawGoogleEvent[]): ValidatedBatch<RawGoogleEvent> {
  const valid: RawGoogleEvent[] = [];
  const rejected: ValidationFailure[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const id = event?.id;

    if (typeof id !== 'string' || id.trim().length === 0) {
      rejected.push({ externalId: null, reason: 'missing or invalid id' });
      continue;
    }

    // A duplicate identifier in one payload means one of two real meetings would
    // silently overwrite the other. Keep the first, report the second.
    if (seen.has(id)) {
      rejected.push({ externalId: id, reason: 'duplicate identifier in batch' });
      continue;
    }

    const status = event.status;
    if (status !== undefined && (typeof status !== 'string' || !KNOWN_STATUSES.has(status))) {
      rejected.push({ externalId: id, reason: `unknown status "${String(status)}"` });
      continue;
    }

    if (status !== 'cancelled') {
      const startProblem = validateWhen(event['start'], 'start');
      if (startProblem) {
        rejected.push({ externalId: id, reason: startProblem });
        continue;
      }
      // `end` is optional in Google's API for some event kinds, so it is only
      // checked when present — inventing a requirement Google doesn't have would
      // drop valid records.
      if (event['end'] !== undefined) {
        const endProblem = validateWhen(event['end'], 'end');
        if (endProblem) {
          rejected.push({ externalId: id, reason: endProblem });
          continue;
        }
      }
    }

    seen.add(id);
    valid.push(event);
  }

  return { valid, rejected };
}

/**
 * Validate a batch of raw Gmail messages.
 *
 * A message needs an id to be keyed and a threadId to be reasoned about — the
 * pipeline follows conversations, and a message with no thread belongs to none.
 * Everything else about the message is Gmail's to define; we don't second-guess
 * headers or labels, only refuse what can't be stored or joined.
 */
export function validateGmailMessages(
  messages: RawGmailMessage[],
): ValidatedBatch<RawGmailMessage> {
  const valid: RawGmailMessage[] = [];
  const rejected: ValidationFailure[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    const id = message?.id;

    if (typeof id !== 'string' || id.trim().length === 0) {
      rejected.push({ externalId: null, reason: 'missing or invalid id' });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ externalId: id, reason: 'duplicate identifier in batch' });
      continue;
    }
    if (message.threadId !== undefined && typeof message.threadId !== 'string') {
      rejected.push({ externalId: id, reason: 'threadId is not a string' });
      continue;
    }

    seen.add(id);
    valid.push(message);
  }

  return { valid, rejected };
}
