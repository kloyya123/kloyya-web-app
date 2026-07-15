import type { EmailInsights } from '@/types/domain';

/**
 * Per-email AI insights, keyed by email id — the inbox parallel to briefings.
 *
 * Only threads that actually warrant action carry one. The Q3 all-hands recap
 * has none, and that absence is the point: Kloyya draws suggested replies and
 * extracted tasks where they help a decision, not on every message. A detail
 * view without insights is a valid, common state.
 */
export const mockEmailInsights: Record<string, EmailInsights> = {
  email_acme_renewal: {
    emailId: 'email_acme_renewal',
    suggestedReplies: [
      'Confirm you will send a revised Atlas delivery date before 17 July, and propose a short call to walk Marcus through the rescoped plan.',
      'Acknowledge the deadline and ask for a 48-hour extension to firm up the milestone-4 date after Friday’s Atlas review.',
    ],
    extractedTasks: [
      'Send revised Atlas timeline to Acme before 17 July',
      'Confirm milestone-4 delivery date at Friday’s Atlas review',
    ],
    detectedMeeting: {
      title: 'Acme renewal — revised timeline walkthrough',
      proposedAt: null,
      note: 'Marcus offers to “jump on a quick call” once a date is confirmed — no time pinned yet.',
    },
  },
  email_supplier_delay: {
    emailId: 'email_supplier_delay',
    suggestedReplies: [
      'Thank Sofia for the heads-up, ask whether any expedited-freight option could recover part of the three weeks, and request pricing.',
    ],
    extractedTasks: ['Price expedited freight for actuator housings with Precision Parts'],
    detectedMeeting: null,
  },
  email_soc2: {
    emailId: 'email_soc2',
    suggestedReplies: [
      'Confirm the three outstanding artifacts, name an owner for each, and commit to delivery ahead of the 22 July deadline.',
    ],
    extractedTasks: [
      'Assign owners for the three outstanding SOC 2 evidence artifacts',
      'Deliver SOC 2 evidence before 22 July',
    ],
    detectedMeeting: null,
  },
};
