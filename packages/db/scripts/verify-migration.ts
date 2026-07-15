/**
 * Local migration verification — no cloud, no credentials.
 *
 * Applies the committed Drizzle migrations to a fresh in-memory PGLite
 * (embedded Postgres) and asserts the schema landed: every table, every enum,
 * and Row-Level Security enabled on each tenant table. This is the local proof
 * that a migration is sound before it ever reaches Supabase — and the reason
 * dev doesn't need Docker (PGLite is Postgres in-process, unlike SQLite which
 * can't run this schema's enums/arrays/RLS).
 *
 * Run: pnpm --filter @kloyya/db verify:local
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../drizzle');

const EXPECTED_TABLES = [
  'organizations',
  'workspaces',
  'users',
  'memberships',
  'user_preferences',
];
const EXPECTED_ENUMS = [
  'plan',
  'membership_role',
  'work_style',
  'notification_level',
  'goal',
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`✓ ${message}`);
}

async function main(): Promise<void> {
  const client = new PGlite(); // in-memory, discarded on exit
  const db = drizzle(client);

  console.log(`Applying migrations from ${migrationsFolder} to in-memory PGLite…\n`);
  await migrate(db, { migrationsFolder });

  // Tables
  const tables = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '__drizzle_migrations'
    ORDER BY table_name
  `);
  const tableNames = tables.rows.map((r) => r.table_name);
  for (const t of EXPECTED_TABLES) {
    assert(tableNames.includes(t), `table "${t}" exists`);
  }
  assert(
    tableNames.length === EXPECTED_TABLES.length,
    `exactly ${EXPECTED_TABLES.length} tables (got ${tableNames.length}: ${tableNames.join(', ')})`,
  );

  // Enums
  const enums = await db.execute<{ typname: string }>(sql`
    SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
  `);
  const enumNames = enums.rows.map((r) => r.typname);
  for (const e of EXPECTED_ENUMS) {
    assert(enumNames.includes(e), `enum "${e}" exists`);
  }

  // RLS enabled on every tenant table
  const rls = await db.execute<{ relname: string; relrowsecurity: boolean }>(sql`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname <> '__drizzle_migrations'
  `);
  const rlsByTable = new Map(rls.rows.map((r) => [r.relname, r.relrowsecurity]));
  for (const t of EXPECTED_TABLES) {
    assert(rlsByTable.get(t) === true, `RLS enabled on "${t}"`);
  }

  await client.close();
  console.log('\nMigration verified against PGLite — schema is sound. ✓');
}

main().catch((err) => {
  console.error('\nMigration verification FAILED:\n', err);
  process.exit(1);
});
