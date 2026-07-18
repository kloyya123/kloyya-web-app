import { beforeEach, describe, expect, it } from 'vitest';
import { API_STATUS } from '@/types/api';
import { ApiError } from '../http/errors';
import { configureMockTransport } from '../http/mock-transport';
import { DEMO_CREDENTIALS, DEMO_VERIFICATION_CODE, MockAuthService } from './mock-auth-service';
import { clearSession } from './session-store';

configureMockTransport({ instant: true, failureRate: 0 });

/** Unique email per test, so the per-email lockout counter never leaks across tests. */
let counter = 0;
const freshEmail = () => `user${counter++}@northwind.example`;

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the promise to reject with an ApiError.');
}

describe('MockAuthService', () => {
  let auth: MockAuthService;

  beforeEach(() => {
    clearSession();
    auth = new MockAuthService();
  });

  describe('signIn', () => {
    it('returns a session for the demo credentials', async () => {
      const session = await auth.signIn(DEMO_CREDENTIALS);

      expect(session.user.email).toBe(DEMO_CREDENTIALS.email);
      // The session renders the whole authenticated shell — org and workspace,
      // not a token the client was never meant to hold.
      expect(session.organization.id).toBeTruthy();
      expect(session.workspace.id).toBeTruthy();
    });

    it('persists the session so getSession finds it', async () => {
      await auth.signIn(DEMO_CREDENTIALS);
      const session = await auth.getSession();
      expect(session?.user.email).toBe(DEMO_CREDENTIALS.email);
    });

    it('rejects a wrong password with 401', async () => {
      const error = await expectApiError(
        auth.signIn({ email: DEMO_CREDENTIALS.email, password: 'wrong' }),
      );
      expect(error.httpStatus).toBe(API_STATUS.Unauthorized);
      expect(error.isRetryable).toBe(false);
    });

    it('is case-insensitive on the email', async () => {
      const session = await auth.signIn({
        email: DEMO_CREDENTIALS.email.toUpperCase(),
        password: DEMO_CREDENTIALS.password,
      });
      expect(session.user.email).toBe(DEMO_CREDENTIALS.email);
    });

    it('does not leak whether an account exists', async () => {
      // Account-enumeration resistance: an unknown email and a known email with
      // the wrong password must be indistinguishable to the caller.
      const unknown = await expectApiError(
        auth.signIn({ email: freshEmail(), password: 'whatever' }),
      );
      const knownBadPassword = await expectApiError(
        auth.signIn({ email: DEMO_CREDENTIALS.email, password: 'wrong' }),
      );

      expect(unknown.httpStatus).toBe(knownBadPassword.httpStatus);
      expect(unknown.errorCode).toBe(knownBadPassword.errorCode);
      expect(unknown.message).toBe(knownBadPassword.message);
    });

    describe('rate limiting', () => {
      it('locks the account after five failed attempts', async () => {
        const email = freshEmail();
        for (let i = 0; i < 5; i++) {
          await expectApiError(auth.signIn({ email, password: 'wrong' }));
        }

        const locked = await expectApiError(auth.signIn({ email, password: 'wrong' }));
        expect(locked.httpStatus).toBe(API_STATUS.RateLimited);
        expect(locked.isRetryable).toBe(true);
        expect(locked.suggestedResolution).toMatch(/wait/i);
      });

      it('locks per email, so one account cannot lock another', async () => {
        const victim = freshEmail();
        const attacker = freshEmail();

        for (let i = 0; i < 6; i++) {
          await expectApiError(auth.signIn({ email: attacker, password: 'wrong' }));
        }

        // The victim's counter is untouched: still a plain 401, not a 429.
        const error = await expectApiError(auth.signIn({ email: victim, password: 'x' }));
        expect(error.httpStatus).toBe(API_STATUS.Unauthorized);
      });

      it('clears the counter after a successful sign-in', async () => {
        await expectApiError(
          auth.signIn({ email: DEMO_CREDENTIALS.email, password: 'wrong' }),
        );
        await auth.signIn(DEMO_CREDENTIALS);

        // Counter reset: four more failures must not trip the five-attempt lock.
        for (let i = 0; i < 4; i++) {
          const error = await expectApiError(
            auth.signIn({ email: DEMO_CREDENTIALS.email, password: 'wrong' }),
          );
          expect(error.httpStatus).toBe(API_STATUS.Unauthorized);
        }
      });
    });
  });

  describe('signUp', () => {
    it('creates an unverified, un-onboarded user', async () => {
      const session = await auth.signUp({
        fullName: 'Jae Park',
        email: freshEmail(),
        password: 'a-long-enough-password',
      });

      expect(session.user.isEmailVerified).toBe(false);
      expect(session.user.hasCompletedOnboarding).toBe(false);
      expect(session.user.fullName).toBe('Jae Park');
    });

    it('rejects an already registered email with 409', async () => {
      const error = await expectApiError(
        auth.signUp({
          fullName: 'Impostor',
          email: DEMO_CREDENTIALS.email,
          password: 'a-long-enough-password',
        }),
      );
      expect(error.httpStatus).toBe(API_STATUS.Conflict);
    });
  });

  describe('requestPasswordReset', () => {
    it('resolves for an unknown address, revealing nothing', async () => {
      // Must not throw. A 404 here would be an enumeration oracle.
      await expect(auth.requestPasswordReset(freshEmail())).resolves.toBeUndefined();
      await expect(
        auth.requestPasswordReset(DEMO_CREDENTIALS.email),
      ).resolves.toBeUndefined();
    });
  });

  describe('verifyEmail', () => {
    beforeEach(async () => {
      await auth.signUp({
        fullName: 'Jae Park',
        email: freshEmail(),
        password: 'a-long-enough-password',
      });
    });

    it('marks the user verified on the correct code', async () => {
      const session = await auth.verifyEmail(DEMO_VERIFICATION_CODE);
      expect(session.user.isEmailVerified).toBe(true);
    });

    it('tolerates surrounding whitespace from a paste', async () => {
      const session = await auth.verifyEmail(`  ${DEMO_VERIFICATION_CODE} `);
      expect(session.user.isEmailVerified).toBe(true);
    });

    it('rejects a wrong code with 422 and leaves the user unverified', async () => {
      const error = await expectApiError(auth.verifyEmail('000000'));
      expect(error.httpStatus).toBe(API_STATUS.ValidationFailed);

      const session = await auth.getSession();
      expect(session?.user.isEmailVerified).toBe(false);
    });

    it('rejects with 401 when there is no session to verify', async () => {
      clearSession();
      const error = await expectApiError(auth.verifyEmail(DEMO_VERIFICATION_CODE));
      expect(error.httpStatus).toBe(API_STATUS.Unauthorized);
    });
  });

  describe('signOut', () => {
    it('clears the session', async () => {
      await auth.signIn(DEMO_CREDENTIALS);
      await auth.signOut();
      expect(await auth.getSession()).toBeNull();
    });
  });

  describe('completeOnboarding', () => {
    it('flips hasCompletedOnboarding and applies the profile', async () => {
      await auth.signUp({
        fullName: 'Jae Park',
        email: freshEmail(),
        password: 'a-long-enough-password',
      });

      const session = await auth.completeOnboarding({
        fullName: 'Jae Park',
        role: 'Chief of Staff',
        goals: ['make_faster_decisions'],
        priorities: ['Close the Q3 board deck'],
        proactiveness: 'balanced',
        plan: 'free',
      });

      expect(session.user.hasCompletedOnboarding).toBe(true);
      expect(session.preferences.role).toBe('Chief of Staff');
      expect(session.organization.subscriptionTier).toBe('free');
    });

    it('keeps the preference answers instead of discarding them', async () => {
      await auth.signUp({
        fullName: 'Rio Silva',
        email: freshEmail(),
        password: 'a-long-enough-password',
      });

      const session = await auth.completeOnboarding({
        fullName: 'Rio Silva',
        role: 'COO',
        goals: ['track_project_risk', 'prepare_for_meetings'],
        priorities: ['Ship the beta', 'Hire two engineers'],
        proactiveness: 'highly_proactive',
        plan: 'pro',
      });

      // Onboarding explains why each question personalizes Kloyya; throwing the
      // answers away would make that explanation a lie.
      expect(session.preferences.role).toBe('COO');
      expect(session.preferences.goals).toEqual(['track_project_risk', 'prepare_for_meetings']);
      expect(session.preferences.priorities).toEqual(['Ship the beta', 'Hire two engineers']);
      expect(session.preferences.proactiveness).toBe('highly_proactive');
      expect(session.organization.subscriptionTier).toBe('pro');
    });
  });

  describe('updateSettings', () => {
    beforeEach(async () => {
      await auth.signUp({
        fullName: 'Sam Hall',
        email: freshEmail(),
        password: 'a-long-enough-password',
      });
    });

    it('applies only the fields present, leaving the rest alone', async () => {
      const before = await auth.getSession();

      const session = await auth.updateSettings({ jobTitle: 'Head of Ops' });

      expect(session.user.jobTitle).toBe('Head of Ops');
      // A patch must not clear what it did not mention.
      expect(session.user.fullName).toBe(before?.user.fullName);
      expect(session.organization.name).toBe(before?.organization.name);
    });

    it('merges preferences rather than replacing the whole object', async () => {
      const session = await auth.updateSettings({
        preferences: { notificationLevel: 'critical_only' },
      });

      expect(session.preferences.notificationLevel).toBe('critical_only');
      // briefingTime was not in the patch, so it keeps its default.
      expect(session.preferences.briefingTime).toBe('07:00');
    });

    it('persists across a session read', async () => {
      await auth.updateSettings({ fullName: 'Samantha Hall' });
      const session = await auth.getSession();
      expect(session?.user.fullName).toBe('Samantha Hall');
    });

    it('throws 401 with no session', async () => {
      await auth.signOut();
      await expect(auth.updateSettings({ jobTitle: 'x' })).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof ApiError && error.httpStatus === API_STATUS.Unauthorized,
      );
    });
  });
});
