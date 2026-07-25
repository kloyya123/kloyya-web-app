import type {
  BriefingTime,
  Goal,
  NotificationLevel,
  Proactiveness,
  SubscriptionTier,
  TeamSize,
  WorkStyle,
} from '@/services/auth/types';

/**
 * The preference vocabulary: every option a user can pick for how Kloyya behaves.
 *
 * Shared rather than feature-local, because two surfaces ask these questions —
 * Onboarding asks them first, Settings lets you change the answers — and they
 * must never offer different choices for the same preference.
 *
 * Frontend-First Build Instructions: "Explain within the UI why each question
 * helps personalize Kloyya." The `description` field below is therefore not
 * optional copy — it is the requirement. Keeping it beside each option means a
 * new question cannot be added without answering "why are we asking?"
 *
 * Design Manifesto tone: advisory, never commanding. "Kloyya uses this to…",
 * not "We need this to…".
 */

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export const GOAL_OPTIONS: Option<Goal>[] = [
  {
    value: 'make_faster_decisions',
    label: 'Make faster decisions',
    description: 'Surface the decision that matters today, with the evidence behind it.',
  },
  {
    value: 'track_project_risk',
    label: 'Stay ahead of project risk',
    description: 'Catch slipping milestones before they reach a customer.',
  },
  {
    value: 'prepare_for_meetings',
    label: 'Walk into meetings prepared',
    description: 'A briefing before every meeting, drawn from what already happened.',
  },
  {
    value: 'stay_on_top_of_email',
    label: 'Stay on top of email',
    description: 'The threads that need you, separated from the ones that don’t.',
  },
  {
    value: 'reduce_meeting_load',
    label: 'Reduce meeting load',
    description: 'Identify meetings a summary could have replaced.',
  },
  {
    value: 'organize_knowledge',
    label: 'Organize what the team knows',
    description: 'Turn scattered documents into an organizational memory.',
  },
];

export const TEAM_SIZE_OPTIONS: Option<TeamSize>[] = [
  { value: '1-10', label: '1–10 people' },
  { value: '11-50', label: '11–50 people' },
  { value: '51-200', label: '51–200 people' },
  { value: '201-1000', label: '201–1,000 people' },
  { value: '1000+', label: 'More than 1,000 people' },
];

export const WORK_STYLE_OPTIONS: Option<WorkStyle>[] = [
  {
    value: 'deep_focus',
    label: 'Long stretches of focused work',
    description: 'Kloyya will protect focus blocks and batch its interruptions.',
  },
  {
    value: 'collaborative',
    label: 'Mostly meetings and collaboration',
    description: 'Kloyya will prioritize meeting preparation and follow-ups.',
  },
  {
    value: 'reactive',
    label: 'Responding as things come in',
    description: 'Kloyya will rank your inbox and surface what changed.',
  },
];

export const BRIEFING_TIME_OPTIONS: Option<BriefingTime>[] = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: 'off', label: 'No morning briefing', description: 'You can turn this on later.' },
];

export const NOTIFICATION_LEVEL_OPTIONS: Option<NotificationLevel>[] = [
  {
    value: 'critical_only',
    label: 'Only what is critical',
    description: 'Interrupts you for scores of 90 and above. Nothing else.',
  },
  {
    value: 'important_only',
    label: 'Important updates',
    description: 'The recommended setting. High-priority work, no noise.',
  },
  {
    value: 'everything',
    label: 'Everything',
    description: 'Every update, as it happens. Most people turn this back down.',
  },
];

/**
 * Roles for the onboarding "who are you" step. Presented as a card grid, with an
 * "Other" free-text escape hatch — role is stored as free-form text, so a title
 * we didn't list is a first-class answer, not a fallback.
 */
export const ROLE_OPTIONS = [
  'Founder',
  'Executive',
  'Manager',
  'Software Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Operations',
  'Finance',
  'Consulting',
  'Student',
] as const;

export const PROACTIVENESS_OPTIONS: Option<Proactiveness>[] = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Kloyya waits to be asked. It answers when you come to it.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'The recommended setting. Kloyya surfaces what matters, quietly.',
  },
  {
    value: 'highly_proactive',
    label: 'Highly proactive',
    description: 'Kloyya reaches out with briefings, risks, and suggestions as they arise.',
  },
];

/** A subscription tier as shown on the onboarding plan step. */
export interface PlanOption {
  value: SubscriptionTier;
  name: string;
  tagline: string;
  /** Monthly list price in USD. 0 for Free. */
  priceUsd: number;
  /** A beta discount, as a fraction (0.5 = 50% off). Applied to `priceUsd`. */
  discount?: number;
  features: string[];
  /** The visually emphasised tier. */
  highlighted?: boolean;
}

/**
 * Beta plans: Free and Pro only (no Max yet). Pro carries a 50% private-beta
 * discount, so $20 shows as $10. Selecting a plan here does not take payment —
 * billing is out of scope for the beta; this records the intended tier.
 */
export const PLAN_OPTIONS: PlanOption[] = [
  {
    value: 'free',
    name: 'Free',
    tagline: 'Everything you need to try Kloyya.',
    priceUsd: 0,
    features: [
      'Connect your core tools',
      'Ask Kloyya across your workspace',
      'Daily briefing and recommendations',
      'Drafts and document upload',
    ],
  },
  {
    value: 'pro',
    name: 'Pro',
    tagline: 'The full assistant, for people who live in their work.',
    priceUsd: 20,
    discount: 0.5,
    highlighted: true,
    features: [
      'Everything in Free',
      'Higher usage limits',
      'Priority AI responses',
      'Early access to new features',
    ],
  },
];

export const INDUSTRY_OPTIONS = [
  'Industrial Automation',
  'Software & Technology',
  'Financial Services',
  'Healthcare',
  'Professional Services',
  'Manufacturing',
  'Retail & Consumer',
  'Energy & Utilities',
  'Public Sector',
  'Other',
] as const;

/**
 * The onboarding steps, in order — the fast, guided personalization the beta
 * spec asks for. One question per screen, each with a `why` that says how the
 * answer personalizes Kloyya (a build requirement, not decorative copy). The
 * user's name comes from sign-up, so onboarding never asks for it again.
 */
export const STEPS = [
  {
    id: 'role',
    title: 'What best describes your role?',
    why: 'Your role decides what Kloyya puts first. A founder and an engineer see different things on the same project.',
  },
  {
    id: 'help',
    title: 'What should Kloyya help with most?',
    why: 'Kloyya ranks recommendations against what you choose. Pick as many as fit.',
  },
  {
    id: 'priorities',
    title: 'What are your top priorities right now?',
    why: 'Kloyya keeps these in view and weighs today’s work against them.',
  },
  {
    id: 'proactiveness',
    title: 'How proactive should Kloyya be?',
    why: 'This sets when Kloyya speaks up and when it stays quiet. You can change it anytime.',
  },
  // The plan step is deliberately absent: no payment processor accepts Zambian
  // cards yet, so showing prices would advertise something nobody can buy.
  // Everyone is provisioned on `free`. Restore this step alongside billing.
] as const;

export type StepId = (typeof STEPS)[number]['id'];
