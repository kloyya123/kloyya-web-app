import { isApiError } from '../http/errors';
import { apiFetch, authFetch } from '../http/transport';
import type {
  AuthService,
  OnboardingProfile,
  Session,
  SettingsPatch,
  SignInInput,
  SignUpInput,
} from './types';

/**
 * The real AuthService: Better Auth for identity, our API for the profile.
 *
 * It implements the exact same contract MockAuthService did, so nothing above it
 * changes. The split inside is deliberate and mirrors the backend: authentication
 * (sign in/up/out, verification, reset) goes to Better Auth at /api/auth/*, while
 * everything that reads or writes the domain session goes to our /v1 API. Neither
 * half invents what the other owns.
 *
 * There is no token anywhere in here. The session is an httpOnly cookie the
 * browser carries; these methods just cause it to be set, cleared, or sent.
 */
export class HttpAuthService implements AuthService {
  /**
   * The current session, or null. Cheap and safe to call on every page.
   *
   * A 401 is not an error here — it is the answer "nobody is signed in", so it
   * resolves to null rather than throwing. Every other failure (the API is down,
   * a malformed response) still throws, because those are real and hiding them
   * would strand the user on a blank page with no explanation.
   */
  async getSession(): Promise<Session | null> {
    try {
      return await apiFetch<Session>('/v1/session');
    } catch (error) {
      if (isApiError(error) && error.httpStatus === 401) return null;
      throw error;
    }
  }

  async signIn(input: SignInInput): Promise<Session> {
    // Better Auth sets the session cookie; it does not return our domain session.
    await authFetch('/sign-in/email', {
      body: { email: input.email, password: input.password },
    });
    return this.requireSession();
  }

  async signUp(input: SignUpInput): Promise<Session> {
    // Sign-up provisions the tenant server-side (org, workspace, profile) and
    // emails the verification code; the returned session is unverified until the
    // user enters it.
    await authFetch('/sign-up/email', {
      body: { email: input.email, password: input.password, name: input.fullName },
    });
    return this.requireSession();
  }

  async signOut(): Promise<void> {
    await authFetch('/sign-out');
  }

  /**
   * Always resolves, even for an unknown address.
   *
   * Account-enumeration resistance is a server property here — the endpoint
   * answers the same for a known and an unknown address — but we also swallow any
   * error client-side, so a transient failure can't become a signal an attacker
   * reads off the form either.
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await authFetch('/email-otp/send-verification-otp', {
        body: { email, type: 'forget-password' },
      });
    } catch {
      // Deliberately ignored — see above.
    }
  }

  /**
   * Verify the emailed code.
   *
   * The code alone isn't enough for Better Auth's OTP endpoint — it needs the
   * address too. We read it from the current session rather than passing it
   * around the UI, so a user can only ever verify the account they're signed in
   * as.
   */
  async verifyEmail(code: string): Promise<Session> {
    const email = await this.currentEmail();
    await authFetch('/email-otp/verify-email', { body: { email, otp: code } });
    return this.requireSession();
  }

  async resendVerificationCode(): Promise<void> {
    const email = await this.currentEmail();
    await authFetch('/email-otp/send-verification-otp', {
      body: { email, type: 'email-verification' },
    });
  }

  /** Onboarding returns the composed session directly — no follow-up read. */
  async completeOnboarding(profile: OnboardingProfile): Promise<Session> {
    return apiFetch<Session>('/v1/onboarding', { method: 'POST', body: profile });
  }

  /** Settings returns the composed session directly. */
  async updateSettings(patch: SettingsPatch): Promise<Session> {
    return apiFetch<Session>('/v1/settings', { method: 'PATCH', body: patch });
  }

  /** The session, or a thrown 401 — for flows that only run while signed in. */
  private async requireSession(): Promise<Session> {
    const session = await this.getSession();
    if (!session) {
      // Reaching here means auth succeeded but the session read came back empty,
      // which is a real inconsistency, not a "not signed in".
      throw new Error('Signed in, but no session could be loaded.');
    }
    return session;
  }

  private async currentEmail(): Promise<string> {
    const session = await this.getSession();
    if (!session) throw new Error('No active session to verify.');
    return session.user.email;
  }
}
