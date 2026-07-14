import { mockOrganization, mockUser, mockWorkspace } from '@/mock/organization';
import { API_STATUS } from '@/types/api';
import type { User } from '@/types/domain';
import { mockError, mockRespond } from '../http/mock-transport';
import { clearSession, readSession, writeSession } from './session-store';
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
 * Mock authentication.
 *
 * Two properties matter more than realism:
 *
 * 1. It behaves like the real thing at the *boundary*. Same errors, same status
 *    codes, same rate limiting, same account-enumeration resistance. Screens
 *    built against it need no changes when Supabase replaces it.
 *
 * 2. It never pretends to be secure. There is no password hashing here because
 *    there is no server. The demo credential is a constant. What it does model
 *    faithfully is *which failures the UI must handle*.
 */

/** The seeded account. Shown on the login screen so the demo is discoverable. */
export const DEMO_CREDENTIALS = {
  email: 'amara.osei@northwind.example',
  password: 'kloyya-demo',
} as const;

/** The verification code the "email" contains. */
export const DEMO_VERIFICATION_CODE = '482913';

/**
 * KESM requires rate limiting on authentication. Modelled per-email rather than
 * globally, so one attacker cannot lock every user out.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const attempts = new Map<string, AttemptRecord>();

function assertNotRateLimited(email: string): void {
  const record = attempts.get(email);
  if (!record) return;

  const elapsed = Date.now() - record.firstAttemptAt;
  if (elapsed > LOCKOUT_MS) {
    attempts.delete(email);
    return;
  }

  if (record.count >= MAX_ATTEMPTS) {
    const waitSeconds = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
    mockError(
      API_STATUS.RateLimited,
      'too_many_attempts',
      'Too many sign-in attempts.',
      `This account is temporarily locked after ${MAX_ATTEMPTS} failed attempts.`,
      `Wait ${waitSeconds} seconds, then try again.`,
    );
  }
}

function recordFailure(email: string): void {
  const record = attempts.get(email);
  if (record && Date.now() - record.firstAttemptAt <= LOCKOUT_MS) {
    record.count += 1;
    return;
  }
  attempts.set(email, { count: 1, firstAttemptAt: Date.now() });
}

function buildSession(user: User): Session {
  return {
    user,
    organization: mockOrganization,
    workspace: mockWorkspace,
    preferences: DEFAULT_PREFERENCES,
    accessToken: `mock_at_${crypto.randomUUID()}`,
    expiresAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  };
}

/** Where a freshly signed-up (unverified, un-onboarded) user starts. */
function newUserFrom(input: SignUpInput): User {
  return {
    id: `user_${crypto.randomUUID().slice(0, 8)}`,
    organizationId: mockOrganization.id,
    email: input.email,
    fullName: input.fullName,
    jobTitle: '',
    role: 'employee',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isEmailVerified: false,
    hasCompletedOnboarding: false,
    createdAt: new Date().toISOString(),
  };
}

export class MockAuthService implements AuthService {
  async getSession(): Promise<Session | null> {
    return readSession();
  }

  async signIn(input: SignInInput): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    assertNotRateLimited(email);

    const { data: matches } = await mockRespond(
      email === DEMO_CREDENTIALS.email && input.password === DEMO_CREDENTIALS.password,
    );

    if (!matches) {
      recordFailure(email);
      // One message for "no such user" and "wrong password" alike. Distinguishing
      // them turns the login form into an account-enumeration oracle.
      mockError(
        API_STATUS.Unauthorized,
        'invalid_credentials',
        'That email and password do not match.',
        'Kloyya could not verify those credentials.',
        'Check your email and password, then try again.',
      );
    }

    attempts.delete(email);
    const session = buildSession(mockUser);
    writeSession(session);
    return session;
  }

  async signUp(input: SignUpInput): Promise<Session> {
    const email = input.email.trim().toLowerCase();

    const { data: alreadyRegistered } = await mockRespond(
      email === DEMO_CREDENTIALS.email,
    );

    if (alreadyRegistered) {
      mockError(
        API_STATUS.Conflict,
        'email_taken',
        'That email is already registered.',
        'An account already exists for this address.',
        'Sign in instead, or reset your password.',
      );
    }

    const session = buildSession(newUserFrom({ ...input, email }));
    writeSession(session);
    return session;
  }

  async signOut(): Promise<void> {
    await mockRespond(null);
    clearSession();
  }

  async requestPasswordReset(email: string): Promise<void> {
    // Resolves for every address, known or not. See AuthService docs: returning
    // 404 here would leak which employees have accounts.
    await mockRespond(email);
  }

  async verifyEmail(code: string): Promise<Session> {
    const current = readSession();
    if (!current) {
      mockError(
        API_STATUS.Unauthorized,
        'no_session',
        'Your session has expired.',
        'Kloyya could not find an active sign-up to verify.',
        'Sign up again to receive a new code.',
      );
    }

    const { data: isValid } = await mockRespond(code.trim() === DEMO_VERIFICATION_CODE);

    if (!isValid) {
      mockError(
        API_STATUS.ValidationFailed,
        'invalid_code',
        'That code is not valid.',
        'The verification code is incorrect or has expired.',
        'Check the code in your email, or request a new one.',
      );
    }

    const session: Session = {
      ...current,
      user: { ...current.user, isEmailVerified: true },
    };
    writeSession(session);
    return session;
  }

  async resendVerificationCode(): Promise<void> {
    await mockRespond(null);
  }

  async completeOnboarding(profile: OnboardingProfile): Promise<Session> {
    const current = readSession();
    if (!current) {
      mockError(
        API_STATUS.Unauthorized,
        'no_session',
        'Your session has expired.',
        'Kloyya could not find an active session to update.',
        'Sign in again to continue.',
      );
    }

    await mockRespond(profile);

    const session: Session = {
      ...current,
      user: {
        ...current.user,
        fullName: profile.fullName,
        jobTitle: profile.jobTitle,
        hasCompletedOnboarding: true,
      },
      organization: { ...current.organization, name: profile.companyName, industry: profile.industry },
      // Onboarding asks these five questions and explains why each one
      // personalizes Kloyya. Dropping the answers would make that a lie.
      preferences: {
        teamSize: profile.teamSize,
        goals: profile.goals,
        workStyle: profile.workStyle,
        briefingTime: profile.briefingTime,
        notificationLevel: profile.notificationLevel,
      },
    };
    writeSession(session);
    return session;
  }

  async updateSettings(patch: SettingsPatch): Promise<Session> {
    const current = readSession();
    if (!current) {
      mockError(
        API_STATUS.Unauthorized,
        'session_expired',
        'Your session has expired.',
        'Kloyya could not find an active session to update.',
        'Sign in again to continue.',
      );
    }

    await mockRespond(patch);

    // A patch: absent fields keep their current value rather than being cleared.
    const session: Session = {
      ...current,
      user: {
        ...current.user,
        fullName: patch.fullName ?? current.user.fullName,
        jobTitle: patch.jobTitle ?? current.user.jobTitle,
      },
      organization: {
        ...current.organization,
        name: patch.companyName ?? current.organization.name,
        industry: patch.industry ?? current.organization.industry,
      },
      preferences: { ...current.preferences, ...patch.preferences },
    };
    writeSession(session);
    return session;
  }
}
