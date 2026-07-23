import { supabaseBrowser } from '@/lib/supabase/browser';
import { API_STATUS } from '@/types/api';
import { ApiError, isApiError } from '../http/errors';
import { apiFetch } from '../http/transport';
import { DEFAULT_PREFERENCES } from './types';
import type {
  AuthService,
  OnboardingProfile,
  Session,
  SettingsPatch,
  SignInInput,
  SignUpInput,
} from './types';

/**
 * The real AuthService, on Supabase Auth.
 *
 * Identity (sign in/up/out, email-OTP verification, password reset) goes to
 * Supabase; the domain session (profile, org, workspace, preferences) still
 * comes from our own `/v1` Route Handlers. It implements the exact contract
 * MockAuthService did, so nothing above it changes — that seam is the whole
 * point of the frontend-first build.
 *
 * There is no token anywhere in here: Supabase stores the session in a cookie the
 * browser carries, and our API reads it server-side. These methods just cause it
 * to be set, cleared, or sent.
 */

/** Where the just-verified email waits between sign-up and the verify screen. */
const PENDING_EMAIL_KEY = 'kloyya_pending_email';

function setPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Private mode / storage disabled: verifyEmail falls back to the form value.
  }
}

function pendingEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * A minimal, unverified session for the window between sign-up and email
 * confirmation, when Supabase has issued no real session yet. The verify screen
 * reads the email off it; the tenant is a placeholder until the real session
 * loads after verification (which is when provisioning runs server-side).
 */
function unverifiedSession(email: string, fullName: string): Session {
  return {
    user: {
      id: 'pending',
      organizationId: 'pending',
      email,
      fullName,
      jobTitle: '',
      role: 'employee',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isEmailVerified: false,
      hasCompletedOnboarding: false,
      createdAt: new Date().toISOString(),
    },
    organization: { id: 'pending', name: '', industry: '', plan: 'starter', subscriptionTier: 'free' },
    workspace: { id: 'pending', organizationId: 'pending', name: '', trustScore: 0 },
    preferences: DEFAULT_PREFERENCES,
  };
}

export class SupabaseAuthService implements AuthService {
  private get sb() {
    return supabaseBrowser();
  }

  /**
   * The current session, or null. A 401 from `/v1/session` is the answer "nobody
   * is signed in", so it resolves to null; every other failure still throws.
   */
  async getSession(): Promise<Session | null> {
    try {
      return await apiFetch<Session>('/v1/session');
    } catch (error) {
      if (isApiError(error) && error.httpStatus === API_STATUS.Unauthorized) return null;
      throw error;
    }
  }

  async signIn(input: SignInInput): Promise<Session> {
    const { error } = await this.sb.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw signInError(error);
    // The cookie is set; the domain session read includes it.
    return this.requireSession();
  }

  /**
   * Sign up. With email confirmation on, Supabase issues NO session — it sends a
   * 6-digit code (the Confirm-signup template is configured to `{{ .Token }}`).
   * We stash the email for the verify screen and return a synthesized unverified
   * session, mirroring the mock. The tenant is provisioned lazily on the first
   * real `/v1/session`, after verification.
   */
  async signUp(input: SignUpInput): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    const { data, error } = await this.sb.auth.signUp({
      email,
      password: input.password,
      options: { data: { full_name: input.fullName } },
    });
    if (error) throw signUpError(error);

    // With enumeration protection on, an existing address returns a user with an
    // empty identities array and no session — treat that as "already registered".
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      throw new ApiError({
        errorCode: 'email_taken',
        httpStatus: API_STATUS.Conflict,
        message: 'That email is already registered.',
        description: 'An account already exists for this address.',
        suggestedResolution: 'Sign in instead, or reset your password.',
        correlationId: 'auth',
        timestamp: new Date().toISOString(),
      });
    }

    setPendingEmail(email);
    return unverifiedSession(email, input.fullName);
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  /**
   * Always resolves, even for an unknown address — Supabase already answers the
   * same for known and unknown, and we swallow transient errors so a failure
   * can't become an enumeration signal read off the form.
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.sb.auth.resetPasswordForEmail(email);
    } catch {
      // Deliberately ignored — see above.
    }
  }

  /**
   * Verify the emailed 6-digit code. On success a real session cookie exists, so
   * the domain-session read succeeds — and it is that read which provisions the
   * tenant server-side (via ensureProvisioned in the session route).
   */
  async verifyEmail(code: string): Promise<Session> {
    const email = pendingEmail();
    if (!email) {
      throw new ApiError({
        errorCode: 'no_pending_verification',
        httpStatus: API_STATUS.Unauthorized,
        message: 'We could not find a sign-up to verify.',
        description: 'The verification context was lost — sign up again to get a new code.',
        suggestedResolution: 'Sign up again to receive a new code.',
        correlationId: 'auth',
        timestamp: new Date().toISOString(),
      });
    }

    const { error } = await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) {
      throw new ApiError({
        errorCode: 'invalid_code',
        httpStatus: API_STATUS.ValidationFailed,
        message: 'That code is not valid.',
        description: 'The verification code is incorrect or has expired.',
        suggestedResolution: 'Check the code in your email, or request a new one.',
        correlationId: 'auth',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      // ignore
    }
    return this.requireSession();
  }

  async resendVerificationCode(): Promise<void> {
    const email = pendingEmail();
    if (!email) return;
    await this.sb.auth.resend({ type: 'signup', email });
  }

  /**
   * Onboarding returns the composed session directly, and the server stamps
   * `onboarded` into user metadata. Refresh the client session so the freshly
   * minted claim rides the JWT the middleware reads.
   */
  async completeOnboarding(profile: OnboardingProfile): Promise<Session> {
    const session = await apiFetch<Session>('/v1/onboarding', { method: 'POST', body: profile });
    await this.sb.auth.refreshSession();
    return session;
  }

  async updateSettings(patch: SettingsPatch): Promise<Session> {
    return apiFetch<Session>('/v1/settings', { method: 'PATCH', body: patch });
  }

  private async requireSession(): Promise<Session> {
    const session = await this.getSession();
    if (!session) throw new Error('Signed in, but no session could be loaded.');
    return session;
  }
}

interface SupabaseAuthError {
  message: string;
  status?: number | undefined;
  code?: string | undefined;
}

function signInError(error: SupabaseAuthError): ApiError {
  const rateLimited = error.status === 429;
  return new ApiError({
    errorCode: rateLimited ? 'too_many_attempts' : 'invalid_credentials',
    httpStatus: rateLimited ? API_STATUS.RateLimited : API_STATUS.Unauthorized,
    message: rateLimited ? 'Too many sign-in attempts.' : 'That email and password do not match.',
    // One message for "no such user" and "wrong password" — anything else turns
    // the form into an account-enumeration oracle.
    description: rateLimited
      ? 'This account is temporarily locked after repeated attempts.'
      : 'Kloyya could not verify those credentials.',
    suggestedResolution: rateLimited
      ? 'Wait a minute, then try again.'
      : 'Check your email and password, then try again.',
    correlationId: 'auth',
    timestamp: new Date().toISOString(),
  });
}

function signUpError(error: SupabaseAuthError): ApiError {
  const taken = /already registered|already exists/i.test(error.message);
  return new ApiError({
    errorCode: taken ? 'email_taken' : 'signup_failed',
    httpStatus: taken ? API_STATUS.Conflict : API_STATUS.BadRequest,
    message: taken ? 'That email is already registered.' : 'We could not create that account.',
    description: taken ? 'An account already exists for this address.' : error.message,
    suggestedResolution: taken
      ? 'Sign in instead, or reset your password.'
      : 'Check the details and try again.',
    correlationId: 'auth',
    timestamp: new Date().toISOString(),
  });
}
