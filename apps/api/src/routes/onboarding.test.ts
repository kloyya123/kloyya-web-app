import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Onboarding, end to end: a signed-up user posts their answers and gets back a
 * session that reflects every one of them — the profile, the renamed
 * organization, and the five personalization answers that onboarding promised
 * would personalize Kloyya.
 */
let app: FastifyInstance;
let client: PGlite;

beforeAll(async () => {
  ({ app, client } = await createTestApp());
});

afterAll(async () => {
  await app.close();
  await client.close();
});

const validAnswers = {
  fullName: 'Amara Osei',
  jobTitle: 'Chief of Staff',
  companyName: 'Northwind',
  industry: 'Logistics',
  teamSize: '51-200',
  goals: ['reduce_meeting_load', 'prepare_for_meetings'],
  workStyle: 'collaborative',
  briefingTime: '08:00',
  notificationLevel: 'critical_only',
} as const;

describe('POST /v1/onboarding', () => {
  it('persists every answer and returns the updated session', async () => {
    const { cookie } = await signUp(app, {
      email: 'amara@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Amara',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: validAnswers,
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json<{
      data: {
        user: { fullName: string; jobTitle: string; hasCompletedOnboarding: boolean; role: string };
        organization: { name: string; industry: string; plan: string };
        workspace: { name: string; trustScore: number };
        preferences: Record<string, unknown>;
      };
    }>();

    // Profile answers landed, and the dashboard gate is now open.
    expect(data.user.fullName).toBe('Amara Osei');
    expect(data.user.jobTitle).toBe('Chief of Staff');
    expect(data.user.hasCompletedOnboarding).toBe(true);
    expect(data.user.role).toBe('owner');

    // The owner renamed the placeholder organization.
    expect(data.organization.name).toBe('Northwind');
    expect(data.organization.industry).toBe('Logistics');
    expect(data.organization.plan).toBe('starter');

    expect(data.workspace.name).toBe('General');
    expect(data.workspace.trustScore).toBe(0);

    // The five questions onboarding asked are not thrown away.
    expect(data.preferences).toEqual({
      teamSize: '51-200',
      goals: ['reduce_meeting_load', 'prepare_for_meetings'],
      workStyle: 'collaborative',
      briefingTime: '08:00',
      notificationLevel: 'critical_only',
    });
  });

  it('reflects the answers on a subsequent GET /v1/me', async () => {
    const { cookie } = await signUp(app, {
      email: 'persist@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Before Name',
    });

    await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { ...validAnswers, fullName: 'After Name', jobTitle: 'Analyst' },
    });

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const { data } = me.json<{
      data: { fullName: string; jobTitle: string; hasCompletedOnboarding: boolean };
    }>();
    expect(data.fullName).toBe('After Name');
    expect(data.jobTitle).toBe('Analyst');
    expect(data.hasCompletedOnboarding).toBe(true);
  });

  it('rejects an unknown enum value with a 422 KAS envelope', async () => {
    const { cookie } = await signUp(app, {
      email: 'invalid@kloyya.test',
      password: 'a sufficiently long passphrase',
      name: 'Invalid',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { ...validAnswers, workStyle: 'telepathy' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<{ error: { errorCode: string } }>();
    expect(body.error.errorCode).toBe('validation_failed');
  });

  it('requires a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { 'content-type': 'application/json' },
      payload: validAnswers,
    });

    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { errorCode: string } }>();
    expect(body.error.errorCode).toBe('unauthorized');
  });
});
