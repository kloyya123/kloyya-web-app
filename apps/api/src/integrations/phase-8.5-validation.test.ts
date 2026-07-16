import { describe, expect, it } from 'vitest';
import { INTEGRATION_CATALOG } from '@kloyya/core';
import { GOOGLE_SCOPES } from './google.js';
import { validateCalendarEvents } from './validation.js';

/**
 * PHASE 8.5 — Integration Validation & Data Integrity.
 *
 * "No external data should enter the Context Engine, Memory System, Knowledge
 * Graph, Search Engine, or Recommendation Engine unless it passes validation."
 *
 * This file is that gate, executable. Each block below is one of the spec's own
 * deliverables, asserted rather than described — a validation phase that exists
 * as prose is a validation phase that stops being true the first time someone
 * edits a connector in a hurry.
 *
 * The Authentication and Data Retrieval deliverables are proven by driving real
 * behaviour, in tokens.test.ts (refresh, expiry, revocation detection) and
 * sync.test.ts (pagination, incremental sync, deleted records, updates,
 * duplicate prevention). This file covers what those cannot: the promises.
 */

describe('8.5 Permissions Validation — only approved scopes are requested', () => {
  it('requests read-only scopes and nothing else', () => {
    // Spec: "Google Calendar ✓ Read calendars ✗ Modify calendars".
    // The safest way to never modify a calendar is to never hold the permission.
    for (const [integrationId, scopes] of Object.entries(GOOGLE_SCOPES)) {
      expect(scopes.length, `${integrationId} requests no scopes`).toBeGreaterThan(0);
      for (const scope of scopes) {
        expect(scope, `${integrationId} requests a non-read-only scope: ${scope}`).toMatch(
          /\.readonly$/,
        );
      }
    }
  });

  it('never requests a scope for a tool the catalogue does not offer', () => {
    // A scope with no card is a permission nobody was ever shown.
    const catalogueIds = new Set(INTEGRATION_CATALOG.map((d) => d.id));
    for (const integrationId of Object.keys(GOOGLE_SCOPES)) {
      expect(catalogueIds.has(integrationId), `"${integrationId}" has scopes but no card`).toBe(true);
    }
  });

  it('honours every promise the connectable cards make', () => {
    // Spec: "Every permission must be intentional and documented." The card IS
    // the documentation, so the card and the scopes must agree — a card that
    // says "never Edit events" above a request for calendar.events write access
    // would be a lie the user cannot see.
    const forbiddenWords = /^(edit|modify|delete|send|create|write|share)/i;

    for (const integrationId of Object.keys(GOOGLE_SCOPES)) {
      const card = INTEGRATION_CATALOG.find((d) => d.id === integrationId);
      expect(card, `no card for ${integrationId}`).toBeDefined();

      // Both lists non-empty: "a review with nothing to review is not a review".
      expect(card!.permissions.granted.length).toBeGreaterThan(0);
      expect(card!.permissions.notGranted.length).toBeGreaterThan(0);

      // Everything the card refuses is an action our scopes cannot perform,
      // because every scope we hold is read-only.
      const refusesMutation = card!.permissions.notGranted.some((p) => forbiddenWords.test(p));
      expect(refusesMutation, `${integrationId}'s card refuses nothing`).toBe(true);

      // The spec calls this out by name for every connector.
      expect(
        card!.permissions.notGranted.some((p) => /share data externally/i.test(p)),
        `${integrationId} does not promise never to share data externally`,
      ).toBe(true);
    }
  });

  it('promises to read only what a read-only scope can reach', () => {
    // Spec: "Google Drive ✓ Read approved files ✗ Read private files outside
    // user permission." We ask for drive.metadata.readonly — the narrowest scope
    // that serves the card, and one that cannot open file contents at all.
    expect(GOOGLE_SCOPES['google_drive']).toEqual([
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ]);
    // Spec: "Gmail ✓ Read messages ✗ Send emails without user approval."
    expect(GOOGLE_SCOPES['gmail']).toEqual(['https://www.googleapis.com/auth/gmail.readonly']);
  });
});

describe('8.5 Data Validation — reject before storage', () => {
  const good = {
    id: 'e1',
    status: 'confirmed',
    start: { dateTime: '2026-02-01T10:00:00Z' },
    end: { dateTime: '2026-02-01T11:00:00Z' },
  };

  it('accepts a well-formed event', () => {
    const { valid, rejected } = validateCalendarEvents([good]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('rejects invalid IDs', () => {
    // Spec: "Invalid IDs". Without an id there is nothing to key on, and
    // inventing one would fabricate provider data.
    const { valid, rejected } = validateCalendarEvents([
      { id: '' },
      { id: '   ' },
      { id: 42 as unknown as string },
      {} as never,
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(4);
    expect(rejected.every((r) => /invalid id/i.test(r.reason))).toBe(true);
  });

  it('rejects duplicate identifiers', () => {
    // Spec: "Duplicate identifiers", "Duplicate records are prevented".
    // Silently upserting both would lose one of two real meetings.
    const { valid, rejected } = validateCalendarEvents([good, { ...good, status: 'tentative' }]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatch(/duplicate/i);
  });

  it('rejects invalid timestamps', () => {
    // Spec: "Invalid timestamps". One unparseable date poisons every downstream
    // comparison that ever touches it.
    const { valid, rejected } = validateCalendarEvents([
      { id: 'bad-start', status: 'confirmed', start: { dateTime: 'next tuesday-ish' } },
      {
        id: 'bad-end',
        status: 'confirmed',
        start: { dateTime: '2026-02-01T10:00:00Z' },
        end: { dateTime: 'whenever' },
      },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((r) => /timestamp|date/i.test(r.reason))).toBe(true);
  });

  it('rejects missing required fields', () => {
    // Spec: "Missing required fields". A live event with no start is not an
    // event we can reason about.
    const { valid, rejected } = validateCalendarEvents([{ id: 'no-start', status: 'confirmed' }]);
    expect(valid).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/start is missing/i);
  });

  it('rejects unknown object types', () => {
    // Spec: "Unknown object types". A status Google has never issued means we are
    // reading something we do not understand.
    const { valid, rejected } = validateCalendarEvents([
      { id: 'weird', status: 'quantum-superposition' },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/unknown status/i);
  });

  it('accepts an all-day event — a date is not a corrupted dateTime', () => {
    // Google expresses all-day events with `date`. Demanding `dateTime` would
    // quietly drop every holiday and out-of-office in the calendar.
    const { valid, rejected } = validateCalendarEvents([
      { id: 'ooo', status: 'confirmed', start: { date: '2026-02-01' }, end: { date: '2026-02-02' } },
    ]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('accepts a cancelled event stripped to an id — that is what a tombstone is', () => {
    // Google sends deletions as little more than an id and a status. Holding
    // them to the live-event bar would reject the very records that tell us a
    // meeting is gone.
    const { valid, rejected } = validateCalendarEvents([{ id: 'gone', status: 'cancelled' }]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('keeps the good records when one is bad', () => {
    // One corrupted object must not cost a user their whole calendar.
    const { valid, rejected } = validateCalendarEvents([
      good,
      { id: 'broken', status: 'confirmed', start: { dateTime: 'nonsense' } },
      { id: 'e2', status: 'confirmed', start: { dateTime: '2026-02-02T10:00:00Z' } },
    ]);
    expect(valid.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(rejected).toHaveLength(1);
  });

  it('reports what it rejected, rather than swallowing it', () => {
    // A connector that quietly drops records is indistinguishable from one that
    // works — until someone asks why a meeting never appeared.
    const { rejected } = validateCalendarEvents([{ id: 'x', status: 'confirmed' }]);
    expect(rejected[0]).toMatchObject({ externalId: 'x' });
    expect(rejected[0]?.reason.length).toBeGreaterThan(0);
  });
});
