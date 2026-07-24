import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { AppDb } from '@kloyya/db/client';
import { createTestDb, createTestIdentity, startContextFor } from '../test/harness';
import type { StartContext } from '../tenant';
import { createTask } from '../tasks/service';
import { createProject, getHealth, getProject, listProjects } from './service';

/**
 * Projects over the real DB. What matters: worst-health-first ordering, the
 * detail view resolves the owner's name and joins the project's own tasks, the
 * health read is a deterministic explanation of the stored scores (no AI
 * health agent exists yet), and one workspace never sees another's projects.
 */
let client: PGlite;
let db: AppDb;

beforeAll(async () => {
  ({ db, client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

async function workspace(email: string, name = 'Owner'): Promise<StartContext> {
  const identity = await createTestIdentity(db, { email, name });
  return startContextFor(db, identity);
}

describe('projects', () => {
  it('creates and lists worst health first', async () => {
    const ctx = await workspace('projects-health@kloyya.test');
    const healthy = await createProject(db, ctx, { name: 'Steady', healthScore: 90 });
    const atRisk = await createProject(db, ctx, { name: 'Wobbly', healthScore: 20 });

    const list = await listProjects(db, ctx);
    expect(list.map((p) => p.id)).toEqual([atRisk.id, healthy.id]);
  });

  it('resolves the owner name and joins the project’s tasks', async () => {
    const ctx = await workspace('projects-detail@kloyya.test', 'Sam Rivera');
    const project = await createProject(db, ctx, { name: 'Atlas', ownerId: ctx.userId });
    const task = await createTask(db, ctx, { title: 'Kickoff', projectId: project.id });
    await createTask(db, ctx, { title: 'Unrelated' });

    const detail = await getProject(db, ctx, project.id);
    expect(detail?.ownerName).toBe('Sam Rivera');
    expect(detail?.tasks.map((t) => t.id)).toEqual([task.id]);
  });

  it('derives a health read from the stored scores', async () => {
    const ctx = await workspace('projects-health-read@kloyya.test');
    const project = await createProject(db, ctx, {
      name: 'At risk',
      healthScore: 20,
      riskScore: 80,
      progress: 10,
    });

    const health = await getHealth(db, ctx, project.id);
    expect(health?.headline).toBe('This project is at risk.');
    expect(health?.drivers.length).toBeGreaterThan(0);
  });

  it('keeps each workspace’s projects to itself', async () => {
    const a = await workspace('projects-tenant-a@kloyya.test');
    const b = await workspace('projects-tenant-b@kloyya.test');
    const projectA = await createProject(db, a, { name: 'A secret' });

    expect(await listProjects(db, b)).toHaveLength(0);
    expect(await getProject(db, b, projectA.id)).toBeNull();
    expect(await getHealth(db, b, projectA.id)).toBeNull();
    expect((await getProject(db, a, projectA.id))?.name).toBe('A secret');
  });
});
