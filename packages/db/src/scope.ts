import { sql } from 'drizzle-orm';
import type { AppDb } from './client.js';

/** The transaction handle a scoped callback receives. Derived from the db so it
 *  tracks the driver rather than being hand-maintained. */
export type Tx = Parameters<Parameters<AppDb['transaction']>[0]>[0];

/**
 * Run a query inside a tenant's boundary, enforced by Postgres rather than by
 * our own diligence.
 *
 * Two things happen for the length of the transaction, and revert with it:
 *
 *   SET LOCAL ROLE app_tenant   — we stop being the table owner, so the RLS
 *                                 policies stop being bypassed and start applying.
 *   app.current_org_id = <org>  — the value every policy compares against.
 *
 * Inside `fn`, a query that forgets its `WHERE organization_id = …` returns only
 * this organization's rows anyway, and an INSERT aimed at another organization is
 * rejected by the policies' WITH CHECK. That is the point: app-layer scoping is
 * ergonomics, this is the guarantee. A bug in a service becomes an empty result,
 * not a cross-tenant leak.
 *
 * Use the unscoped `db` only where crossing tenants is the actual job — running
 * migrations, provisioning a brand-new organization, and Better Auth's identity
 * lookups (which happen before any org is known).
 *
 * The org id is bound as a parameter via set_config rather than interpolated into
 * a SET statement, which cannot take parameters.
 */
export async function withTenantScope<T>(
  db: AppDb,
  organizationId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_tenant`);
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true)`);
    return fn(tx);
  });
}
