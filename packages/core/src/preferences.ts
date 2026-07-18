/**
 * User preferences and onboarding — the answers Kloyya collects and the shapes
 * that carry them.
 *
 * These live in @kloyya/core because both ends need them: onboarding collects
 * them in the web app, the API validates and persists them, and the API returns
 * them on the session. They were originally defined in the web app's auth
 * service; moving them here makes one definition serve both sides.
 */

export const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const GOALS = [
  'reduce_meeting_load',
  'stay_on_top_of_email',
  'track_project_risk',
  'prepare_for_meetings',
  'organize_knowledge',
  'make_faster_decisions',
] as const;
export type Goal = (typeof GOALS)[number];

export const WORK_STYLES = ['deep_focus', 'collaborative', 'reactive'] as const;
export type WorkStyle = (typeof WORK_STYLES)[number];

/**
 * How much Kloyya should insert itself. Set at onboarding, tunable in Settings.
 * `balanced` is the default — present without being noisy.
 */
export const PROACTIVENESS = ['minimal', 'balanced', 'highly_proactive'] as const;
export type Proactiveness = (typeof PROACTIVENESS)[number];

/**
 * Beta subscription tiers. Free and Pro only — no Max during the private beta.
 * This lives on the (internal) organization; the plan step in onboarding sets it.
 */
export const SUBSCRIPTION_TIERS = ['free', 'pro'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const BRIEFING_TIMES = ['06:00', '07:00', '08:00', '09:00', 'off'] as const;
export type BriefingTime = (typeof BRIEFING_TIMES)[number];

/**
 * Design Manifesto: "Does this deserve interruption? If not, don't notify."
 * The default is `important_only`, not `everything`.
 */
export const NOTIFICATION_LEVELS = ['everything', 'important_only', 'critical_only'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export interface UserPreferences {
  /** How the user describes their work, e.g. "Founder" or a custom title. Set at
   *  onboarding; drives what Kloyya puts first. Free-form so "Other" is real. */
  role: string;
  /** What the user most wants Kloyya to help with — the onboarding "help with"
   *  answers. Reuses the goal vocabulary; ranking reads against these. */
  goals: Goal[];
  /** The user's own words for what matters right now. Free-form, multi. */
  priorities: string[];
  /** How assertive Kloyya should be. */
  proactiveness: Proactiveness;
  /** These four are no longer asked at onboarding (kept lightweight, per the beta
   *  spec) — they carry sensible defaults and are editable in Settings. */
  teamSize: TeamSize;
  workStyle: WorkStyle;
  briefingTime: BriefingTime;
  notificationLevel: NotificationLevel;
}

/**
 * What a brand-new session starts with. `important_only` rather than
 * `everything`, per the Manifesto: "Does this deserve interruption? If not,
 * don't notify."
 *
 * These mirror the column defaults in the database schema; the two must agree.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  role: '',
  goals: [],
  priorities: [],
  proactiveness: 'balanced',
  teamSize: '51-200',
  workStyle: 'deep_focus',
  briefingTime: '07:00',
  notificationLevel: 'important_only',
};

/**
 * Everything onboarding collects — the private-beta flow.
 *
 * Deliberately short (the beta spec asks for a fast, guided personalization):
 * who you are, what to help with, what matters now, how proactive to be, and
 * which plan. The org-shaped questions (company, industry, team size) and the
 * "how you work" preferences are no longer asked here — they default and can be
 * changed in Settings — because onboarding should feel effortless, not like a
 * form.
 */
export interface OnboardingProfile {
  fullName: string;
  role: string;
  /** "What should Kloyya help with most?" */
  goals: Goal[];
  /** "What are your top priorities right now?" */
  priorities: string[];
  proactiveness: Proactiveness;
  /** The plan chosen on the final onboarding step. */
  plan: SubscriptionTier;
}

/** Everything Settings may change. Every field optional — it's a patch. */
export interface SettingsPatch {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  industry?: string;
  preferences?: Partial<UserPreferences>;
}
