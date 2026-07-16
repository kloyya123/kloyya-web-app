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

export const BRIEFING_TIMES = ['06:00', '07:00', '08:00', '09:00', 'off'] as const;
export type BriefingTime = (typeof BRIEFING_TIMES)[number];

/**
 * Design Manifesto: "Does this deserve interruption? If not, don't notify."
 * The default is `important_only`, not `everything`.
 */
export const NOTIFICATION_LEVELS = ['everything', 'important_only', 'critical_only'] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export interface UserPreferences {
  teamSize: TeamSize;
  goals: Goal[];
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
  teamSize: '51-200',
  goals: [],
  workStyle: 'deep_focus',
  briefingTime: '07:00',
  notificationLevel: 'important_only',
};

/**
 * Everything onboarding collects. Sourced from the Frontend-First Build
 * Instructions (Phase 2) and the V1 spec's onboarding section.
 */
export interface OnboardingProfile {
  fullName: string;
  jobTitle: string;
  companyName: string;
  industry: string;
  teamSize: TeamSize;
  goals: Goal[];
  workStyle: WorkStyle;
  briefingTime: BriefingTime;
  notificationLevel: NotificationLevel;
}

/** Everything Settings may change. Every field optional — it's a patch. */
export interface SettingsPatch {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  industry?: string;
  preferences?: Partial<UserPreferences>;
}
