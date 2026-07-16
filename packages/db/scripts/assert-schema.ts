import { sql } from 'drizzle-orm';

/**
 * The schema assertions, shared by the local (PGLite) and remote (Supabase)
 * verifiers.
 *
 * One definition on purpose: these are security checks as much as schema checks,
 * and a duplicated security check is one that quietly drifts. What we prove
 * locally before shipping is exactly what we prove against the cloud after.
 */

/**
 * The tenant tables — everything scoped to an organization. These carry the
 * isolation policies; the identity tables deliberately do not (Better Auth must
 * reach them before any org context exists).
 */
export const TENANT_TABLES = [
  'organizations',
  'workspaces',
  'users',
  'memberships',
  'user_preferences',
];

export const EXPECTED_TABLES = [
  // Better Auth identity tables
  'user',
  'session',
  'account',
  'verification',
  ...TENANT_TABLES,
];

export const EXPECTED_ENUMS = ['plan', 'membership_role', 'work_style', 'notification_level', 'goal'];

/**
 * Run raw SQL and return rows.
 *
 * Deliberately a function rather than a db object: drizzle's postgres-js driver
 * resolves `execute` to the row array itself, while the pglite driver resolves to
 * `{ rows, fields }`. Each verifier adapts its own driver at the call site, so
 * that difference can't silently produce `undefined.map` in here.
 */
export type Query = <T>(query: ReturnType<typeof sql>) => Promise<T[]>;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`✗ ${message}`);
    throw new Error(message);
  }
  console.log(`✓ ${message}`);
}

export async function assertSchema(query: Query, options: { exactTables: boolean }): Promise<void> {
  const tables = await query<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations'
    ORDER BY table_name
  `);
  const tableNames = tables.map((r) => r.table_name);
  for (const t of EXPECTED_TABLES) {
    assert(tableNames.includes(t), `table "${t}" exists`);
  }
  if (options.exactTables) {
    assert(
      tableNames.length === EXPECTED_TABLES.length,
      `exactly ${EXPECTED_TABLES.length} tables (got ${tableNames.length}: ${tableNames.join(', ')})`,
    );
  }

  const enums = await query<{ typname: string }>(sql`
    SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
  `);
  const enumNames = enums.map((r) => r.typname);
  for (const e of EXPECTED_ENUMS) {
    assert(enumNames.includes(e), `enum "${e}" exists`);
  }

  const rls = await query<{ relname: string; relrowsecurity: boolean }>(sql`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname <> '__drizzle_migrations'
  `);
  const rlsByTable = new Map(rls.map((r) => [r.relname, r.relrowsecurity]));
  for (const t of EXPECTED_TABLES) {
    assert(rlsByTable.get(t) === true, `RLS enabled on "${t}"`);
  }

  // Enabling RLS without policies protects nothing from the owner; the tenant
  // tables must also FORCE it and carry an isolation policy.
  const forced = await query<{ relname: string; relforcerowsecurity: boolean }>(sql`
    SELECT c.relname, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  const forcedByTable = new Map(forced.map((r) => [r.relname, r.relforcerowsecurity]));
  for (const t of TENANT_TABLES) {
    assert(forcedByTable.get(t) === true, `RLS FORCED on "${t}"`);
  }

  const policies = await query<{ tablename: string }>(sql`
    SELECT tablename FROM pg_policies WHERE schemaname = 'public'
  `);
  const policyTables = new Set(policies.map((r) => r.tablename));
  for (const t of TENANT_TABLES) {
    assert(policyTables.has(t), `tenant isolation policy on "${t}"`);
  }

  const roles = await query<{ rolname: string }>(sql`
    SELECT rolname FROM pg_roles WHERE rolname = 'app_tenant'
  `);
  assert(roles.length === 1, 'role "app_tenant" exists');
}
