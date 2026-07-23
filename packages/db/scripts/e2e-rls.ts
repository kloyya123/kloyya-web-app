import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema';
import { withTenantScope } from '../src/scope';

/**
 * End-to-end tenant-isolation test against the REAL Supabase DB through the
 * transaction pooler (DATABASE_URL, the exact path the app uses at runtime).
 *
 * Proves the #1 migration risk is not real: `SET LOCAL ROLE app_tenant` + the
 * per-request GUC survive pgbouncer transaction pooling, so RLS still isolates
 * one workspace's data from another's. Provisions two tenants, writes feedback
 * as each, asserts neither can see the other's, then cleans up.
 */
async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema, casing: 'snake_case' });

  const created: string[] = [];
  try {
    const a = await provision(db, 'e2e-a');
    const b = await provision(db, 'e2e-b');
    created.push(a.orgId, b.orgId);
    console.log('provisioned two tenants on real Supabase ✓');

    // Write feedback as each tenant, inside its own scope (RLS + GUC).
    await withTenantScope(db, a.orgId, async (tx) => {
      await tx.insert(schema.feedback).values({
        organizationId: a.orgId,
        workspaceId: a.workspaceId,
        userId: a.userId,
        type: 'bug',
        title: 'A-only',
        body: 'secret to tenant A',
      });
    });
    await withTenantScope(db, b.orgId, async (tx) => {
      await tx.insert(schema.feedback).values({
        organizationId: b.orgId,
        workspaceId: b.workspaceId,
        userId: b.userId,
        type: 'general',
        title: 'B-only',
        body: 'secret to tenant B',
      });
    });

    // Each tenant sees ONLY its own row, even with no WHERE on organization_id.
    const aRows = await withTenantScope(db, a.orgId, (tx) => tx.select().from(schema.feedback));
    const bRows = await withTenantScope(db, b.orgId, (tx) => tx.select().from(schema.feedback));

    const aTitles = aRows.map((r) => r.title).sort();
    const bTitles = bRows.map((r) => r.title).sort();
    console.log('tenant A sees:', aTitles);
    console.log('tenant B sees:', bTitles);

    const isolated =
      aTitles.every((t) => t === 'A-only') &&
      bTitles.every((t) => t === 'B-only') &&
      aRows.length === 1 &&
      bRows.length === 1;

    if (!isolated) throw new Error('RLS ISOLATION FAILED — a tenant saw another tenant’s data!');
    console.log('RLS tenant isolation on Supabase pooler: PASS ✓');

    // WITH CHECK: an insert aimed at another org from inside A's scope is rejected.
    let checkEnforced = false;
    try {
      await withTenantScope(db, a.orgId, async (tx) => {
        await tx.insert(schema.feedback).values({
          organizationId: b.orgId, // not ours
          workspaceId: b.workspaceId,
          userId: a.userId,
          type: 'bug',
          title: 'cross-tenant write',
          body: 'should be rejected',
        });
      });
    } catch {
      checkEnforced = true;
    }
    console.log('RLS WITH CHECK blocks cross-tenant write:', checkEnforced ? 'PASS ✓' : 'FAIL ✗');
    if (!checkEnforced) throw new Error('RLS WITH CHECK did not block a cross-tenant insert!');
  } finally {
    // Cleanup: delete the test orgs (cascades to workspaces/users/feedback).
    for (const orgId of created) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId)).catch(() => {});
    }
    await sql.end({ timeout: 5 });
    console.log('cleaned up test tenants ✓');
  }
}

/** Minimal tenant provisioning (org + workspace + profile + membership + prefs). */
async function provision(db: ReturnType<typeof drizzle>, label: string) {
  const userId = randomUUID();
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: `${label} Org`, industry: '' })
      .returning({ id: schema.organizations.id });
    const [ws] = await tx
      .insert(schema.workspaces)
      .values({ organizationId: org!.id, name: 'General' })
      .returning({ id: schema.workspaces.id });
    await tx.insert(schema.users).values({
      id: userId,
      organizationId: org!.id,
      activeWorkspaceId: ws!.id,
      fullName: label,
      email: `${label}@e2e.test`,
    });
    await tx.insert(schema.memberships).values({
      organizationId: org!.id,
      workspaceId: ws!.id,
      userId,
      role: 'owner',
    });
    await tx.insert(schema.userPreferences).values({ userId });
    return { orgId: org!.id, workspaceId: ws!.id, userId };
  });
}

main().catch((error) => {
  console.error('E2E FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
