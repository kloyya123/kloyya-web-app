import type {
  Agent,
  AppNotification,
  Briefing,
  EmailThread,
  Evidence,
  KnowledgeArticle,
  Meeting,
  Organization,
  Project,
  Recommendation,
  Task,
  User,
  Workspace,
} from '@/types/domain';
import { priorityFromDecisionScore } from '@/lib/decision-score';

/**
 * One coherent fictional organization.
 *
 * The Master Build Prompt forbids "fake production data". This is not that: it
 * is a *consistent* narrative. Every recommendation's evidence points at a real
 * record in this file. The contract renewal recommendation cites the actual
 * email thread and the actual meeting. If a screen shows evidence, you can find
 * the thing it cites.
 *
 * That consistency is the point. Incoherent mock data lets you ship an evidence
 * panel that has never once displayed evidence that resolves.
 */

const ORG_ID = 'org_northwind';
const WORKSPACE_ID = 'ws_northwind_exec';

// Fixed clock so the mock narrative is stable and tests are deterministic.
// Relative helpers keep the data feeling "today" without wall-clock drift.
const NOW = new Date('2026-07-10T08:00:00.000Z');

/**
 * The narrative clock, exported for services that split "upcoming" from "past".
 * Comparing mock timestamps against the real wall clock silently rots the demo:
 * the moment real time passes 2026-07-10T11:00Z, the Atlas review the briefing
 * talks about would drop off every "coming up" list.
 */
export const MOCK_NOW = NOW;
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
const daysAhead = (d: number) => hoursAhead(d * 24);

// Inbox timestamps track the REAL wall clock so the demo always reads as live
// ("2m ago"), instead of freezing to the narrative date and looking abandoned.
const liveMinutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const liveHoursAgo = (h: number) => liveMinutesAgo(h * 60);
const liveDaysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const base = (id: string, createdBy = 'user_amara') => ({
  id,
  organizationId: ORG_ID,
  workspaceId: WORKSPACE_ID,
  createdBy,
  updatedBy: createdBy,
  createdAt: daysAgo(30),
  updatedAt: hoursAgo(2),
  version: 1,
});

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export const mockOrganization: Organization = {
  id: ORG_ID,
  name: 'Northwind Robotics',
  industry: 'Industrial Automation',
  plan: 'enterprise',
  subscriptionTier: 'pro',
};

export const mockWorkspace: Workspace = {
  id: WORKSPACE_ID,
  organizationId: ORG_ID,
  name: 'Executive',
  trustScore: 87,
};

export const mockUser: User = {
  id: 'user_amara',
  organizationId: ORG_ID,
  email: 'amara.osei@northwind.example',
  fullName: 'Amara Osei',
  jobTitle: 'Chief Operating Officer',
  role: 'executive',
  timezone: 'Europe/London',
  isEmailVerified: true,
  hasCompletedOnboarding: true,
  createdAt: daysAgo(240),
};

export const mockTeammates: User[] = [
  {
    id: 'user_daniel',
    organizationId: ORG_ID,
    email: 'daniel.reyes@northwind.example',
    fullName: 'Daniel Reyes',
    jobTitle: 'VP Engineering',
    role: 'manager',
    timezone: 'America/New_York',
    isEmailVerified: true,
    hasCompletedOnboarding: true,
    createdAt: daysAgo(220),
  },
  {
    id: 'user_lena',
    organizationId: ORG_ID,
    email: 'lena.fischer@northwind.example',
    fullName: 'Lena Fischer',
    jobTitle: 'Head of Legal',
    role: 'manager',
    timezone: 'Europe/Berlin',
    isEmailVerified: true,
    hasCompletedOnboarding: true,
    createdAt: daysAgo(180),
  },
  {
    id: 'user_priya',
    organizationId: ORG_ID,
    email: 'priya.nair@northwind.example',
    fullName: 'Priya Nair',
    jobTitle: 'Director of Product',
    role: 'manager',
    timezone: 'Asia/Kolkata',
    isEmailVerified: true,
    hasCompletedOnboarding: true,
    createdAt: daysAgo(160),
  },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const mockProjects: Project[] = [
  {
    ...base('proj_atlas', 'user_daniel'),
    name: 'Atlas — Warehouse Fleet v3',
    status: 'at_risk',
    ownerId: 'user_daniel',
    progress: 62,
    riskScore: 78,
    healthScore: 54,
    deadline: daysAhead(24),
  },
  {
    ...base('proj_meridian', 'user_priya'),
    name: 'Meridian — Customer Portal',
    status: 'active',
    ownerId: 'user_priya',
    progress: 41,
    riskScore: 22,
    healthScore: 82,
    deadline: daysAhead(61),
  },
  {
    ...base('proj_harbor', 'user_lena'),
    name: 'Harbor — SOC 2 Type II',
    status: 'active',
    ownerId: 'user_lena',
    progress: 88,
    riskScore: 31,
    healthScore: 91,
    deadline: daysAhead(12),
  },
];

// ---------------------------------------------------------------------------
// Meetings, email, tasks — the substrate the recommendations cite
// ---------------------------------------------------------------------------

export const mockMeetings: Meeting[] = [
  {
    ...base('meet_atlas_review', 'user_daniel'),
    title: 'Atlas milestone review',
    startsAt: hoursAhead(3),
    endsAt: hoursAhead(4),
    participants: [
      { userId: 'user_amara', fullName: 'Amara Osei' },
      { userId: 'user_daniel', fullName: 'Daniel Reyes' },
    ],
    summary: null,
    agenda: [
      'Milestone 4 slippage and root cause',
      'Supplier lead time for actuator housings',
      'Decision: rescope or extend deadline',
    ],
    actionItems: [],
    decisions: [],
    followUps: [],
    projectId: 'proj_atlas',
    summaryConfidence: null,
  },
  {
    ...base('meet_acme_qbr', 'user_amara'),
    title: 'Acme Logistics — quarterly business review',
    startsAt: daysAgo(6),
    endsAt: daysAgo(6),
    participants: [
      { userId: 'user_amara', fullName: 'Amara Osei' },
      { userId: 'user_lena', fullName: 'Lena Fischer' },
    ],
    summary:
      'Acme raised concerns about Atlas delivery timing before their contract renews. Lena flagged the auto-renewal clause in section 8.',
    agenda: ['Delivery timeline', 'Contract renewal', 'Support escalations'],
    actionItems: [
      'Send revised Atlas timeline to Acme by 12 July',
      'Legal to review section 8 auto-renewal',
    ],
    decisions: [
      'Renewal proceeds only once a revised delivery date is confirmed.',
      'No pricing changes this cycle; scope stays as contracted.',
    ],
    followUps: [
      'Acme board reviews on 17 July — expect a decision that week.',
      'Watch section 8 auto-renewal window if the date slips.',
    ],
    summaryConfidence: 92,
  },
  {
    ...base('meet_meridian_design', 'user_priya'),
    title: 'Meridian portal — design review',
    startsAt: daysAgo(3),
    endsAt: daysAgo(3),
    participants: [
      { userId: 'user_amara', fullName: 'Amara Osei' },
      { userId: 'user_priya', fullName: 'Priya Nair' },
    ],
    summary:
      'The customer portal onboarding flow was approved with one revision: order tracking moves to the first screen. Engineering estimates no impact on the Q3 date.',
    agenda: ['Onboarding flow walkthrough', 'Order tracking placement', 'Q3 scope check'],
    actionItems: ['Priya to circulate revised onboarding flow by Friday'],
    decisions: ['Order tracking moves to the first screen of the portal.'],
    followUps: ['Confirm engineering estimate once the revised flow lands.'],
    projectId: 'proj_meridian',
    summaryConfidence: 89,
  },
  {
    ...base('meet_q3_planning', 'user_amara'),
    title: 'Q3 planning kickoff',
    startsAt: daysAgo(9),
    endsAt: daysAgo(9),
    participants: [
      { userId: 'user_amara', fullName: 'Amara Osei' },
      { userId: 'user_daniel', fullName: 'Daniel Reyes' },
      { userId: 'user_priya', fullName: 'Priya Nair' },
      { userId: 'user_lena', fullName: 'Lena Fischer' },
    ],
    summary:
      'Q3 priorities set: Atlas delivery, SOC 2 completion, and Meridian beta. Hiring for the staff engineer role continues; the platform team backfill is deferred.',
    agenda: ['Q2 review', 'Q3 priorities', 'Hiring plan'],
    actionItems: [
      'Daniel to draft the Atlas resourcing plan',
      'Lena to schedule the SOC 2 evidence review',
    ],
    decisions: [
      'Q3 priorities: Atlas delivery, SOC 2, Meridian beta — in that order.',
      'Platform team backfill deferred to Q4.',
    ],
    followUps: ['Revisit the backfill decision if Atlas resourcing falls short.'],
    summaryConfidence: 94,
  },
];

export const mockEmails: EmailThread[] = [
  {
    ...base('email_acme_renewal', 'user_amara'),
    subject: 'Re: Contract renewal — decision needed by 17 July',
    senderName: 'Marcus Webb',
    senderEmail: 'm.webb@acmelogistics.example',
    receivedAt: liveMinutesAgo(2),
    aiSummary:
      'Acme will not renew unless a revised Atlas delivery date is confirmed before 17 July.',
    isUnread: true,
    importanceScore: 96,
    importanceReason:
      'Ties to a €1.4M renewal with a hard 17 July deadline, and blocks your Critical Atlas task.',
    needsReply: true,
  },
  {
    ...base('email_supplier_delay', 'user_daniel'),
    subject: 'Actuator housings — 3 week lead time increase',
    senderName: 'Sofia Marchetti',
    senderEmail: 'sofia@precision-parts.example',
    receivedAt: liveHoursAgo(1),
    aiSummary:
      'Supplier confirms actuator housing lead time moves from 4 to 7 weeks, effective immediately.',
    isUnread: false,
    importanceScore: 84,
    importanceReason:
      'The root cause behind the Atlas slip Acme is asking about — read this before you reply to Marcus.',
    needsReply: false,
  },
  {
    ...base('email_soc2', 'user_lena'),
    subject: 'SOC 2 evidence request — 3 items outstanding',
    senderName: 'Auditor (Vance & Co)',
    senderEmail: 'audit@vanceco.example',
    receivedAt: liveHoursAgo(3),
    aiSummary: 'Three evidence artifacts remain outstanding ahead of the 22 July deadline.',
    isUnread: true,
    importanceScore: 71,
    importanceReason: 'A dated compliance deadline (22 July) with named owners still outstanding.',
    needsReply: true,
  },
  {
    ...base('email_town_hall', 'user_amara'),
    subject: 'Q3 all-hands — agenda & recording',
    senderName: 'People Team',
    senderEmail: 'people@northwind.example',
    receivedAt: liveHoursAgo(5),
    aiSummary: 'Recap and recording of the Q3 all-hands; no action requested of you.',
    isUnread: false,
    importanceScore: 28,
    importanceReason: 'Informational — no deadline, no ask, and you were not named.',
    needsReply: false,
  },
];

export const mockKnowledgeArticles: KnowledgeArticle[] = [
  {
    ...base('art_atlas_rescope', 'user_daniel'),
    title: 'Atlas milestone-4 rescope decision',
    category: 'Decisions',
    aiSummary:
      'Rescoping the housing-dependent work — rather than extending the deadline — preserves Acme’s original delivery date despite the supplier slip.',
    tags: ['atlas', 'delivery', 'acme'],
    authorId: 'user_daniel',
    confidence: 88,
  },
  {
    ...base('art_renewal_policy', 'user_amara'),
    title: 'Enterprise renewal escalation policy',
    category: 'Policies',
    aiSummary:
      'Renewals above €1M escalate to the account lead 30 days out; a slipping delivery date triggers a revised-timeline commitment before any pricing talk.',
    tags: ['sales', 'renewals', 'process'],
    authorId: 'user_amara',
    confidence: 82,
  },
  {
    ...base('art_supplier_playbook', 'user_daniel'),
    title: 'Supplier delay response playbook',
    category: 'Playbooks',
    aiSummary:
      'When a supplier lead time moves, price expedited freight first, then test whether rescoping dependent work protects the customer date before renegotiating it.',
    tags: ['supply-chain', 'risk', 'atlas'],
    authorId: 'user_daniel',
    confidence: 76,
  },
  {
    ...base('art_soc2_readiness', 'user_lena'),
    title: 'SOC 2 evidence checklist',
    category: 'Playbooks',
    aiSummary:
      'The recurring evidence set auditors request, with named owners — kept current so an audit request is a lookup, not a scramble.',
    tags: ['compliance', 'security', 'harbor'],
    authorId: 'user_lena',
    confidence: 71,
  },
  {
    ...base('art_meridian_design', 'user_priya'),
    title: 'Meridian design review outcomes',
    category: 'Decisions',
    aiSummary:
      'The design review settled the sensor-placement approach; two questions on enclosure tooling remain open pending a supplier quote.',
    tags: ['meridian', 'design'],
    authorId: 'user_priya',
    confidence: 69,
  },
];

export const mockTasks: Task[] = [
  {
    ...base('task_revised_timeline', 'user_amara'),
    title: 'Send revised Atlas timeline to Acme',
    status: 'todo',
    priority: 'Critical',
    ownerId: 'user_amara',
    projectId: 'proj_atlas',
    dueAt: liveDaysAhead(0),
    aiPriorityScore: 96,
  },
  {
    ...base('task_section8', 'user_lena'),
    title: 'Review Acme contract section 8 (auto-renewal)',
    status: 'in_progress',
    priority: 'High',
    ownerId: 'user_lena',
    dueAt: liveDaysAhead(0),
    aiPriorityScore: 81,
  },
  {
    ...base('task_soc2_evidence', 'user_lena'),
    title: 'Upload remaining SOC 2 evidence artifacts',
    status: 'todo',
    priority: 'High',
    ownerId: 'user_lena',
    projectId: 'proj_harbor',
    dueAt: liveDaysAhead(1),
    aiPriorityScore: 77,
  },
  {
    ...base('task_resource_plan', 'user_daniel'),
    title: 'Draft Atlas resourcing plan for Q3',
    status: 'blocked',
    priority: 'Medium',
    ownerId: 'user_daniel',
    projectId: 'proj_atlas',
    dueAt: liveDaysAhead(1),
    aiPriorityScore: 58,
  },
];

// ---------------------------------------------------------------------------
// Evidence — every item below is cited by a recommendation, and resolves
// ---------------------------------------------------------------------------

const evidenceAcmeEmail: Evidence = {
  id: 'ev_acme_email',
  sourceType: 'email',
  sourceLabel: 'Gmail — Marcus Webb, Acme Logistics',
  excerpt:
    'We cannot proceed with renewal until we have a confirmed Atlas delivery date. Our board reviews on 17 July.',
  timestamp: hoursAgo(19),
  ownerId: 'user_amara',
  reliability: 96,
  freshness: 98,
  classification: 'confidential',
  href: '/inbox/email_acme_renewal',
};

const evidenceQbrNotes: Evidence = {
  id: 'ev_qbr_notes',
  sourceType: 'meeting_notes',
  sourceLabel: 'Meeting notes — Acme QBR, 4 July',
  excerpt:
    'Acme raised concerns about Atlas delivery timing before their contract renews. Section 8 auto-renewal flagged by Legal.',
  timestamp: daysAgo(6),
  ownerId: 'user_amara',
  reliability: 92,
  freshness: 74,
  classification: 'internal',
  href: '/meetings/meet_acme_qbr',
};

const evidenceSupplierEmail: Evidence = {
  id: 'ev_supplier_email',
  sourceType: 'email',
  sourceLabel: 'Gmail — Sofia Marchetti, Precision Parts',
  excerpt: 'Actuator housing lead time moves from 4 weeks to 7 weeks, effective immediately.',
  timestamp: daysAgo(2),
  ownerId: 'user_daniel',
  reliability: 89,
  freshness: 93,
  classification: 'internal',
  href: '/inbox/email_supplier_delay',
};

const evidenceAtlasProject: Evidence = {
  id: 'ev_atlas_project',
  sourceType: 'project_update',
  sourceLabel: 'Project — Atlas, milestone 4',
  excerpt: 'Milestone 4 is 11 days behind plan. Risk score raised from 45 to 78.',
  timestamp: hoursAgo(8),
  ownerId: 'user_daniel',
  reliability: 94,
  freshness: 99,
  classification: 'internal',
  href: '/projects/proj_atlas',
};

const evidenceSoc2Audit: Evidence = {
  id: 'ev_soc2_audit',
  sourceType: 'email',
  sourceLabel: 'Gmail — Vance & Co, external auditor',
  excerpt: 'Three evidence artifacts remain outstanding ahead of the 22 July deadline.',
  timestamp: daysAgo(1),
  ownerId: 'user_lena',
  reliability: 97,
  freshness: 96,
  classification: 'confidential',
  href: '/inbox/email_soc2',
};

const evidenceCalendarConflict: Evidence = {
  id: 'ev_calendar_conflict',
  sourceType: 'calendar',
  sourceLabel: 'Google Calendar — 10 July',
  excerpt: 'Atlas milestone review (11:00–12:00) has no preparation block before it.',
  timestamp: hoursAgo(1),
  ownerId: 'user_amara',
  reliability: 88,
  freshness: 100,
  classification: 'internal',
  href: '/calendar',
};

export const mockEvidence: Evidence[] = [
  evidenceAcmeEmail,
  evidenceQbrNotes,
  evidenceSupplierEmail,
  evidenceAtlasProject,
  evidenceSoc2Audit,
  evidenceCalendarConflict,
];

// ---------------------------------------------------------------------------
// Recommendations
//
// Every one carries evidence, reasoning, an expected outcome, and the cost of
// ignoring it. Priority is *derived* from decisionScore, never hand-written.
// ---------------------------------------------------------------------------

function recommendation(
  fields: Omit<Recommendation, 'priority' | keyof ReturnType<typeof base>> & {
    id: string;
    createdBy?: string;
  },
): Recommendation {
  const { id, createdBy, ...rest } = fields;
  return {
    ...base(id, createdBy),
    ...rest,
    priority: priorityFromDecisionScore(rest.decisionScore),
  };
}

export const mockRecommendations: Recommendation[] = [
  recommendation({
    id: 'rec_acme_renewal',
    title: 'Confirm a revised Atlas delivery date with Acme before 17 July',
    reason:
      'Acme has made contract renewal conditional on a confirmed delivery date, and their board reviews in seven days.',
    confidence: 94,
    decisionScore: 96,
    risk: 'Critical',
    evidence: [evidenceAcmeEmail, evidenceQbrNotes, evidenceAtlasProject],
    reasoning: [
      {
        id: 'step_1',
        statement: 'Acme stated renewal depends on a confirmed Atlas delivery date.',
        evidenceIds: ['ev_acme_email'],
      },
      {
        id: 'step_2',
        statement: 'Atlas milestone 4 is 11 days behind, so the original date is no longer credible.',
        evidenceIds: ['ev_atlas_project'],
      },
      {
        id: 'step_3',
        statement:
          'Their board reviews on 17 July, which leaves seven days to agree a new date.',
        evidenceIds: ['ev_acme_email', 'ev_qbr_notes'],
      },
    ],
    assumptions: [
      'Acme has not already begun a competitive procurement process.',
      'The revised date can be agreed without renegotiating price.',
    ],
    conflicts: [],
    suggestedAction: {
      label: 'Draft the revised timeline',
      href: '/tasks/task_revised_timeline',
      isDestructive: false,
    },
    expectedOutcome:
      'Acme receives a credible date before their board meets, and the renewal proceeds on schedule.',
    whatHappensIfIgnored:
      'The contract lapses into the section 8 auto-renewal window without an agreed date, and Acme may decline to renew.',
    confirmationRequired: false,
    generatedByAgent: 'risk',
    deliveryChannels: ['dashboard', 'morning_briefing', 'push_notification'],
    outcome: 'pending',
  }),

  recommendation({
    id: 'rec_atlas_rescope',
    title: 'Rescope Atlas milestone 4 rather than extend the deadline',
    reason:
      'The supplier lead-time increase accounts for the entire slippage, and rescoping preserves the customer date.',
    confidence: 78,
    decisionScore: 84,
    risk: 'High',
    evidence: [evidenceSupplierEmail, evidenceAtlasProject],
    reasoning: [
      {
        id: 'step_1',
        statement: 'Actuator housing lead time increased from 4 to 7 weeks.',
        evidenceIds: ['ev_supplier_email'],
      },
      {
        id: 'step_2',
        statement: 'That three-week increase closely matches the 11 working days of slippage.',
        evidenceIds: ['ev_supplier_email', 'ev_atlas_project'],
      },
      {
        id: 'step_3',
        statement:
          'Deferring the housing-dependent scope would let the remaining milestone ship on the original date.',
        evidenceIds: [],
      },
    ],
    assumptions: [
      'The housing-dependent scope can be separated from the rest of milestone 4.',
      'No alternate supplier can meet the original lead time.',
    ],
    conflicts: [],
    suggestedAction: {
      label: 'Open the Atlas milestone review',
      href: '/meetings/meet_atlas_review',
      isDestructive: false,
    },
    expectedOutcome:
      'Milestone 4 ships on the original date with reduced scope, and the customer commitment holds.',
    whatHappensIfIgnored:
      'The deadline extends by three weeks, which pushes delivery past Acme’s renewal decision.',
    confirmationRequired: true,
    generatedByAgent: 'decision',
    deliveryChannels: ['dashboard', 'morning_briefing', 'recommendation_feed'],
    outcome: 'pending',
  }),

  recommendation({
    id: 'rec_meeting_prep',
    title: 'Block 30 minutes to prepare for the Atlas milestone review',
    reason:
      'The review begins in three hours and will decide whether to rescope, with no preparation time scheduled.',
    confidence: 88,
    decisionScore: 79,
    risk: 'Medium',
    evidence: [evidenceCalendarConflict, evidenceAtlasProject],
    reasoning: [
      {
        id: 'step_1',
        statement: 'The Atlas milestone review starts at 11:00 with no preparation block before it.',
        evidenceIds: ['ev_calendar_conflict'],
      },
      {
        id: 'step_2',
        statement:
          'Its agenda includes a rescope-or-extend decision that depends on the current risk position.',
        evidenceIds: ['ev_atlas_project'],
      },
    ],
    assumptions: ['The 09:30–10:00 slot is genuinely free.'],
    conflicts: [],
    suggestedAction: {
      label: 'Hold 09:30–10:00 for preparation',
      href: '/calendar',
      isDestructive: false,
    },
    expectedOutcome:
      'You enter the review with the risk position and supplier constraint already understood.',
    whatHappensIfIgnored:
      'The rescope decision is taken without a reviewed risk position, and is likely to be revisited.',
    confirmationRequired: false,
    generatedByAgent: 'calendar_intelligence',
    deliveryChannels: ['dashboard', 'morning_briefing'],
    outcome: 'pending',
  }),

  recommendation({
    id: 'rec_soc2_evidence',
    title: 'Clear the three outstanding SOC 2 evidence artifacts this week',
    reason:
      'Harbor is 88% complete and the audit deadline is twelve days out, but three artifacts remain outstanding.',
    confidence: 91,
    decisionScore: 76,
    risk: 'Medium',
    evidence: [evidenceSoc2Audit],
    reasoning: [
      {
        id: 'step_1',
        statement: 'The auditor lists three outstanding evidence artifacts.',
        evidenceIds: ['ev_soc2_audit'],
      },
      {
        id: 'step_2',
        statement: 'The 22 July deadline leaves twelve days, and re-review adds a further week.',
        evidenceIds: ['ev_soc2_audit'],
      },
    ],
    assumptions: ['The artifacts exist and need only be uploaded, not produced.'],
    conflicts: [],
    suggestedAction: {
      label: 'Review outstanding artifacts',
      href: '/tasks/task_soc2_evidence',
      isDestructive: false,
    },
    expectedOutcome: 'Harbor completes certification without a deadline extension.',
    whatHappensIfIgnored:
      'The audit slips a cycle, and SOC 2 certification moves out of Q3.',
    confirmationRequired: false,
    generatedByAgent: 'risk',
    deliveryChannels: ['dashboard', 'recommendation_feed'],
    outcome: 'pending',
  }),

  // A Medium item: it earns a place in the recommendation feed but is below the
  // dashboard's High-and-above bar, so it appears here and nowhere proactive.
  recommendation({
    id: 'rec_atlas_status_note',
    title: 'Send the Q3 review a one-line Atlas status before Friday',
    reason:
      'The Q3 planning review will ask about Atlas, and a pre-empted one-liner avoids the topic derailing the agenda.',
    confidence: 72,
    decisionScore: 61,
    risk: 'Low',
    evidence: [evidenceQbrNotes, evidenceAtlasProject],
    reasoning: [
      {
        id: 'step_1',
        statement: 'The Q3 review agenda includes a standing project-health round.',
        evidenceIds: ['ev_qbr_notes'],
      },
      {
        id: 'step_2',
        statement:
          'Atlas is the only project currently at risk, so it will draw the round’s questions.',
        evidenceIds: ['ev_atlas_project'],
      },
    ],
    assumptions: ['The rescope plan is agreed before Friday.'],
    conflicts: [],
    suggestedAction: {
      label: 'Open the Atlas rescope note',
      href: '/knowledge/art_atlas_rescope',
      isDestructive: false,
    },
    expectedOutcome:
      'The review gets a crisp status and moves on, rather than reopening the rescope debate.',
    whatHappensIfIgnored:
      'Atlas is raised cold in the review and consumes time better spent on Q3 planning.',
    confirmationRequired: false,
    generatedByAgent: 'executive_briefing',
    deliveryChannels: ['recommendation_feed', 'morning_briefing'],
    outcome: 'pending',
  }),
];

// ---------------------------------------------------------------------------
// Briefing, agents, notifications
// ---------------------------------------------------------------------------

export const mockBriefing: Briefing = {
  id: 'brief_2026_07_10',
  kind: 'morning',
  generatedAt: hoursAgo(1),
  headline: 'Acme’s renewal now depends on a decision you can make today.',
  narrative:
    'Atlas slipped eleven days after a supplier lead-time increase, and Acme has made their renewal conditional on a confirmed delivery date before their board meets on 17 July. The milestone review at 11:00 is where that date gets decided.',
  confidence: 92,
  recommendationIds: [
    'rec_acme_renewal',
    'rec_atlas_rescope',
    'rec_meeting_prep',
    'rec_soc2_evidence',
  ],
};

export const mockAgents: Agent[] = [
  {
    kind: 'master_orchestrator',
    displayName: 'Orchestrator',
    status: 'idle',
    activity: null,
    lastActiveAt: hoursAgo(1),
  },
  {
    kind: 'risk',
    displayName: 'Risk',
    status: 'thinking',
    activity: 'Reassessing Atlas exposure after the supplier update',
    lastActiveAt: hoursAgo(0.2),
  },
  {
    kind: 'calendar_intelligence',
    displayName: 'Calendar',
    status: 'idle',
    activity: null,
    lastActiveAt: hoursAgo(2),
  },
  {
    kind: 'email_intelligence',
    displayName: 'Email',
    status: 'acting',
    activity: 'Summarizing 4 new threads',
    lastActiveAt: hoursAgo(0.05),
  },
];

export const mockNotifications: AppNotification[] = [
  {
    id: 'notif_acme',
    category: 'ai',
    title: 'Acme renewal needs a delivery date',
    body: 'Their board reviews on 17 July. A revised Atlas date has not been sent.',
    createdAt: hoursAgo(19),
    isRead: false,
    decisionScore: 96,
    href: '/recommendations/rec_acme_renewal',
  },
  {
    id: 'notif_atlas_risk',
    category: 'projects',
    title: 'Atlas risk score rose to 78',
    body: 'Milestone 4 is eleven days behind plan.',
    createdAt: hoursAgo(8),
    isRead: false,
    decisionScore: 81,
    href: '/projects/proj_atlas',
  },
  {
    id: 'notif_meeting',
    category: 'meetings',
    title: 'Atlas milestone review in 3 hours',
    body: 'No preparation time is scheduled.',
    createdAt: hoursAgo(1),
    isRead: false,
    decisionScore: 79,
    href: '/meetings/meet_atlas_review',
  },
  {
    id: 'notif_soc2',
    category: 'tasks',
    title: 'SOC 2 evidence outstanding',
    body: 'Three artifacts remain before the 22 July deadline.',
    createdAt: daysAgo(1),
    isRead: true,
    decisionScore: 76,
    href: '/tasks/task_soc2_evidence',
  },
];
