import type { Organization, User, Workspace } from '@/types/domain';

/**
 * KESM session model: "Short-lived access tokens, Refresh tokens, Device
 * binding, ... Session revocation."
 *
 * The refresh token is deliberately absent from this type. In production it
 * lives in an httpOnly cookie the client cannot read; modelling it here would
 * invite a component to touch it. See MockAuthService for how the mock
 * approximates that boundary.
 */
export interface Session {
  user: User;
  organization: Organization;
  workspace: Workspace;
  /**
   * How this user wants Kloyya to behave. Collected at onboarding and editable
   * in Settings — before this existed, onboarding asked the questions and then
   * threw the answers away.
   */
  preferences: UserPreferences;
  /** Opaque. Never parsed client-side. */
  accessToken: string;
  expiresAt: string;
}

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
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  teamSize: '51-200',
  goals: [],
  workStyle: 'deep_focus',
  briefingTime: '07:00',
  notificationLevel: 'important_only',
};

/** Everything Settings may change. Every field optional — it's a patch. */
export interface SettingsPatch {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  industry?: string;
  preferences?: Partial<UserPreferences>;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

/**
 * The contract the real backend must satisfy.
 *
 * Every method either resolves or throws `ApiError`. No method returns a
 * discriminated result union: a failed sign-in is exceptional, and forcing every
 * call site to unwrap a union makes the happy path unreadable.
 */
export interface AuthService {
  /** Current session, or null. Cheap: reads the stored token, does not refresh. */
  getSession(): Promise<Session | null>;

  /** Throws 401 on bad credentials, 429 when rate-limited. */
  signIn(input: SignInInput): Promise<Session>;

  /**
   * Creates an unverified user and dispatches a verification code.
   * Throws 409 when the email is already registered.
   */
  signUp(input: SignUpInput): Promise<Session>;

  signOut(): Promise<void>;

  /**
   * Always resolves, even for an unknown address.
   *
   * Returning 404 here would turn the form into an account-enumeration oracle:
   * an attacker could discover which employees have Kloyya accounts by
   * submitting addresses and reading the status code.
   */
  requestPasswordReset(email: string): Promise<void>;

  /** Throws 422 when the code is wrong or expired. */
  verifyEmail(code: string): Promise<Session>;

  resendVerificationCode(): Promise<void>;

  /** Persists onboarding answers and flips `hasCompletedOnboarding`. */
  completeOnboarding(profile: OnboardingProfile): Promise<Session>;

  /**
   * Updates profile, organization, and preferences from Settings. A patch: only
   * the fields present are changed. Throws 401 without a session.
   */
  updateSettings(patch: SettingsPatch): Promise<Session>;
}

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
