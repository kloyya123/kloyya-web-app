import type { Evidence, MeetingBriefing, NonEmpty } from '@/types/domain';
import { mockEvidence } from './organization';

/**
 * Pre-meeting briefings, keyed by meeting id.
 *
 * Only upcoming meetings have one — a briefing for a meeting that already
 * happened is a summary wearing the wrong hat. Evidence is drawn from the same
 * shared pool the recommendations cite, so "Open source" links from a briefing
 * resolve to the same records the dashboard argues from.
 */

function evidenceById(...ids: string[]): NonEmpty<Evidence> {
  const found = ids
    .map((id) => mockEvidence.find((item) => item.id === id))
    .filter((item): item is Evidence => item !== undefined);

  const [first, ...rest] = found;
  if (!first) {
    // A briefing without evidence is unconstructible by design; failing loudly
    // here means a typo'd id breaks the build's tests, not the user's screen.
    throw new Error(`No evidence found for ids: ${ids.join(', ')}`);
  }
  return [first, ...rest];
}

export const mockBriefings: Record<string, MeetingBriefing> = {
  meet_atlas_review: {
    meetingId: 'meet_atlas_review',
    headline:
      'This meeting decides whether Atlas rescopes or slips past Acme’s renewal.',
    objective:
      'Leave with an agreed milestone-4 plan and a delivery date you can send to Acme.',
    talkingPoints: [
      'The supplier lead time moved from 4 to 7 weeks — the slippage is external, not execution.',
      'Rescoping the housing-dependent work preserves the original customer date.',
      'Acme’s board reviews on 17 July; whatever date leaves this room must be credible by then.',
    ],
    risks: [
      'Daniel may push to extend the deadline instead — have the rescope trade-offs ready.',
      'No alternate supplier has been priced; an extension argument will lean on that gap.',
    ],
    confidence: 88,
    evidence: evidenceById('ev_supplier_email', 'ev_atlas_project', 'ev_acme_email'),
  },
};
