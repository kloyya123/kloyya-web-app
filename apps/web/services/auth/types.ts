import type { Organization, User, Workspace } from '@/types/domain';
import type { OnboardingProfile, SettingsPatch, UserPreferences } from '@kloyya/core/preferences';

/**
 * Preferences and onboarding shapes now live in @kloyya/core — the API collects,
 * validates, and returns exactly these, so one definition serves both ends.
 * Re-exported here so `@/services/auth/types` remains the app's import site.
 */
export {
  DEFAULT_PREFERENCES,
  TEAM_SIZES,
  GOALS,
  WORK_STYLES,
  BRIEFING_TIMES,
  NOTIFICATION_LEVELS,
} from '@kloyya/core/preferences';
export type {
  TeamSize,
  Goal,
  WorkStyle,
  BriefingTime,
  NotificationLevel,
  UserPreferences,
  OnboardingProfile,
  SettingsPatch,
} from '@kloyya/core/preferences';

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

