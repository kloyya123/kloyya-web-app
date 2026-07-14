import type {
  BriefingTime,
  Goal,
  NotificationLevel,
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

/** The wizard's steps, in order. The `why` is shown beside each step's fields. */
export const STEPS = [
  {
    id: 'about-you',
    title: 'Tell Kloyya who you are',
    why: 'Your role decides what Kloyya puts first. A COO and an engineer see different things on the same project.',
  },
  {
    id: 'your-company',
    title: 'And where you work',
    why: 'Kloyya reads industry and team size to calibrate what counts as a risk worth raising.',
  },
  {
    id: 'your-goals',
    title: 'What should Kloyya help with?',
    why: 'Kloyya ranks recommendations against your goals. Choosing nothing means everything competes equally.',
  },
  {
    id: 'how-you-work',
    title: 'How do you work?',
    why: 'This sets when Kloyya speaks up and when it stays quiet.',
  },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
