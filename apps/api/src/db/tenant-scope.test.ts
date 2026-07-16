import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { AppDb } from '@kloyya/db';
import { withTenantScope } from '@kloyya/db/scope';
import { organizations, users, workspaces } from '@kloyya/db/schema';
import { createTestApp, signUp } from '../test/app.js';

/**
 * Tenant isolation, proven rather than asserted.
 *
 * Every test below runs a query that WOULD leak if RLS were absent — no
 * organization filter at all — and shows Postgres returning only the current
 * tenant's rows. This is the difference between "our code remembers to scope"
 * and "the database will not let us forget".
 */
let app: FastifyInstance;
let db: AppDb;
let client: PGlite;

let orgA: string;
let orgB: string;

beforeAll(async () => {
  ({ app, db, client } = await createTestApp());

  // Two real tenants, created the way real ones are: by signing up.
  await signUp(app, { email: 'a@kloyya.test', password: 'a sufficiently long passphrase', name: 'Alpha' });
  await signUp(app, { email: 'b@kloyya.test', password: 'a sufficiently long passphrase', name: 'Beta' });

  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);
  orgA = rows.find((r) => r.name.startsWith('Alpha'))!.id;
  orgB = rows.find((r) => r.name.startsWith('Beta'))!.id;
  expect(orgA).toBeTruthy();
  expect(orgB).toBeTruthy();
});

afterAll(async () => {
  await app.close();
  await client.close();
});

describe('withTenantScope', () => {
  it('sees every tenant on the unscoped (owner) connection — the baseline', async () => {
    const all = await db.select({ id: organizations.id }).from(organizations);
    expect(all.length).toBe(2);
  });

  it('returns only the current tenant, even with no filter in the query', async () => {
    const seen = await withTenantScope(db, orgA, async (tx) =>
      // Deliberately unfiltered: RLS is what constrains this, not the query.
      tx.select({ id: organizations.id }).from(organizations),
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.id).toBe(orgA);
  });

  it('hides another tenant even when asked for it by id', async () => {
    const seen = await withTenantScope(db, orgA, async (tx) =>
      tx.select({ id: organizations.id }).from(organizations).where(sql`id = ${orgB}`),
    );

    expect(seen).toHaveLength(0);
  });

  it('scopes workspaces and profiles through their organization', async () => {
    const { workspacesSeen, usersSeen } = await withTenantScope(db, orgB, async (tx) => ({
      workspacesSeen: await tx.select({ orgId: workspaces.organizationId }).from(workspaces),
      usersSeen: await tx.select({ orgId: users.organizationId }).from(users),
    }));

    expect(workspacesSeen).toHaveLength(1);
    expect(workspacesSeen[0]?.orgId).toBe(orgB);
    expect(usersSeen).toHaveLength(1);
    expect(usersSeen[0]?.orgId).toBe(orgB);
  });

  it('refuses to write a row into another tenant (policy WITH CHECK)', async () => {
    await expect(
      withTenantScope(db, orgA, async (tx) =>
        tx.insert(workspaces).values({ organizationId: orgB, name: 'Smuggled' }),
      ),
    ).rejects.toThrow();

    // And nothing landed.
    const smuggled = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(sql`name = 'Smuggled'`);
    expect(smuggled).toHaveLength(0);
  });

  it('cannot update another tenant’s row', async () => {
    await withTenantScope(db, orgA, async (tx) =>
      tx.update(organizations).set({ name: 'Hijacked' }).where(sql`id = ${orgB}`),
    );

    // The UPDATE matched nothing rather than renaming org B.
    const [b] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(sql`id = ${orgB}`);
    expect(b?.name).not.toBe('Hijacked');
  });

  it('denies everything when the org id is never set — a forgotten scope leaks nothing', async () => {
    const seen = await db.transaction(async (tx) => {
      // The role, but no app.current_org_id: exactly the bug of forgetting to
      // scope. current_setting(..., true) yields NULL, and NULL matches nothing.
      await tx.execute(sql`SET LOCAL ROLE app_tenant`);
      return tx.select({ id: organizations.id }).from(organizations);
    });

    expect(seen).toHaveLength(0);
  });

  it('restores the owner connection after the scope ends', async () => {
    await withTenantScope(db, orgA, async (tx) =>
      tx.select({ id: organizations.id }).from(organizations),
    );

    // The pooled connection must not still be app_tenant.
    const all = await db.select({ id: organizations.id }).from(organizations);
    expect(all.length).toBe(2);
  });
});
