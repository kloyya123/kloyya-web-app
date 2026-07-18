import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Onboarding, end to end: a signed-up user posts their beta answers and gets
 * back a session that reflects every one of them — the personalization (role,
 * what to help with, priorities, proactiveness) and the plan they chose.
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
  role: 'Chief of Staff',
  goals: ['reduce_meeting_load', 'prepare_for_meetings'],
  priorities: ['Close the Series A', 'Ship the beta'],
  proactiveness: 'highly_proactive',
  plan: 'pro',
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
        user: { fullName: string; hasCompletedOnboarding: boolean; role: string };
        organization: { subscriptionTier: string };
        workspace: { name: string; trustScore: number };
        preferences: {
          role: string;
          goals: string[];
          priorities: string[];
          proactiveness: string;
        };
      };
    }>();

    // Profile answer landed, and the dashboard gate is now open.
    expect(data.user.fullName).toBe('Amara Osei');
    expect(data.user.hasCompletedOnboarding).toBe(true);
    // user.role is the workspace membership role, not the personalization role.
    expect(data.user.role).toBe('owner');

    // The owner's plan choice set the (internal) org's subscription tier.
    expect(data.organization.subscriptionTier).toBe('pro');

    expect(data.workspace.name).toBe('General');
    expect(data.workspace.trustScore).toBe(0);

    // The personalization questions are not thrown away.
    expect(data.preferences.role).toBe('Chief of Staff');
    expect(data.preferences.goals).toEqual(['reduce_meeting_load', 'prepare_for_meetings']);
    expect(data.preferences.priorities).toEqual(['Close the Series A', 'Ship the beta']);
    expect(data.preferences.proactiveness).toBe('highly_proactive');
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
      payload: { ...validAnswers, fullName: 'After Name' },
    });

    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const { data } = me.json<{
      data: { fullName: string; hasCompletedOnboarding: boolean };
    }>();
    expect(data.fullName).toBe('After Name');
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
      payload: { ...validAnswers, proactiveness: 'telepathy' },
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
