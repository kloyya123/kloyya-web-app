import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { memberships } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Settings is a patch. The property that matters most — and the one easiest to
 * break — is that an absent field keeps its current value rather than clearing
 * it. Each test below changes one thing and asserts the rest survived.
 */
let app: FastifyInstance;
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ app, client, db } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

const onboardingAnswers = {
  fullName: 'Original Name',
  jobTitle: 'Original Title',
  companyName: 'Original Co',
  industry: 'Original Industry',
  teamSize: '51-200',
  goals: ['reduce_meeting_load'],
  workStyle: 'deep_focus',
  briefingTime: '07:00',
  notificationLevel: 'important_only',
} as const;

async function onboardedUser(email: string): Promise<string> {
  const { cookie } = await signUp(app, {
    email,
    password: 'a sufficiently long passphrase',
    name: 'Seed',
  });
  await app.inject({
    method: 'POST',
    url: '/v1/onboarding',
    headers: { cookie, 'content-type': 'application/json' },
    payload: onboardingAnswers,
  });
  return cookie;
}

interface SessionBody {
  data: {
    user: { fullName: string; jobTitle: string };
    organization: { name: string; industry: string };
    preferences: {
      teamSize: string;
      goals: string[];
      workStyle: string;
      briefingTime: string;
      notificationLevel: string;
    };
  };
}

describe('PATCH /v1/settings', () => {
  it('changes only the fields present, leaving the rest intact', async () => {
    const cookie = await onboardedUser('patch@kloyya.test');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { jobTitle: 'New Title' },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<SessionBody>();

    expect(data.user.jobTitle).toBe('New Title');
    // Everything absent from the patch is untouched.
    expect(data.user.fullName).toBe('Original Name');
    expect(data.organization.name).toBe('Original Co');
    expect(data.organization.industry).toBe('Original Industry');
    expect(data.preferences.workStyle).toBe('deep_focus');
    expect(data.preferences.goals).toEqual(['reduce_meeting_load']);
  });

  it('merges a partial preferences patch without clearing the others', async () => {
    const cookie = await onboardedUser('prefs@kloyya.test');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { preferences: { notificationLevel: 'critical_only' } },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<SessionBody>();

    expect(data.preferences.notificationLevel).toBe('critical_only');
    // The other four answers survive a partial patch.
    expect(data.preferences.teamSize).toBe('51-200');
    expect(data.preferences.goals).toEqual(['reduce_meeting_load']);
    expect(data.preferences.workStyle).toBe('deep_focus');
    expect(data.preferences.briefingTime).toBe('07:00');
  });

  it('lets an owner rename the organization', async () => {
    const cookie = await onboardedUser('org@kloyya.test');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { companyName: 'Renamed Co', industry: 'Aerospace' },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<SessionBody>();
    expect(data.organization.name).toBe('Renamed Co');
    expect(data.organization.industry).toBe('Aerospace');
  });

  it('accepts an empty patch as a no-op', async () => {
    const cookie = await onboardedUser('noop@kloyya.test');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<SessionBody>();
    expect(data.user.fullName).toBe('Original Name');
    expect(data.preferences.notificationLevel).toBe('important_only');
  });

  it('rejects an unknown enum value with a 422', async () => {
    const cookie = await onboardedUser('badpref@kloyya.test');

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { preferences: { briefingTime: '03:00' } },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('validation_failed');
  });

  it('requires a session', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/settings',
      headers: { 'content-type': 'application/json' },
      payload: { jobTitle: 'Nope' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { errorCode: string } }>().error.errorCode).toBe('unauthorized');
  });

  describe('authorization (RBAC)', () => {
    /** Sign up (which makes an owner), then demote to a role without org:update. */
    async function employeeCookie(email: string): Promise<string> {
      const { cookie, userId } = await signUp(app, {
        email,
        password: 'a sufficiently long passphrase',
        name: 'Rank And File',
      });
      await db
        .update(memberships)
        .set({ role: 'employee' })
        .where(eq(memberships.userId, userId));
      return cookie;
    }

    it('refuses to let an employee rename the organization — 403, not a silent no-op', async () => {
      const cookie = await employeeCookie('employee@kloyya.test');

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/settings',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { companyName: 'Hostile Takeover Inc' },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ error: { errorCode: string; description: string } }>();
      expect(body.error.errorCode).toBe('forbidden');
      // Names the permission, not the role.
      expect(body.error.description).toContain('org:update');

      // And it really didn't happen.
      const me = await app.inject({
        method: 'PATCH',
        url: '/v1/settings',
        headers: { cookie, 'content-type': 'application/json' },
        payload: {},
      });
      expect(me.json<{ data: { organization: { name: string } } }>().data.organization.name).not.toBe(
        'Hostile Takeover Inc',
      );
    });

    it('still lets that employee edit their own profile', async () => {
      const cookie = await employeeCookie('employee2@kloyya.test');

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/settings',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { jobTitle: 'Analyst' },
      });

      // Losing org:update must not cost you your own settings.
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { user: { jobTitle: string } } }>().data.user.jobTitle).toBe('Analyst');
    });

    it('lets an administrator rename the organization', async () => {
      const { cookie, userId } = await signUp(app, {
        email: 'admin@kloyya.test',
        password: 'a sufficiently long passphrase',
        name: 'Admin Person',
      });
      await db
        .update(memberships)
        .set({ role: 'administrator' })
        .where(eq(memberships.userId, userId));

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/settings',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { companyName: 'Admin Renamed Co' },
      });

      // The permission matrix, not a hardcoded `role === 'owner'`, decides this.
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { organization: { name: string } } }>().data.organization.name).toBe(
        'Admin Renamed Co',
      );
    });
  });
});
